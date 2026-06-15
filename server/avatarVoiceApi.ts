import type { IncomingMessage, ServerResponse } from 'node:http';

type AvatarVoiceProvider = 'openai';

export type AvatarVoicePayload = {
  provider: AvatarVoiceProvider;
  input: string;
  voice?: string;
};

type ParsedRequest =
  | { ok: true; payload: AvatarVoicePayload }
  | { ok: false; status: number; error: string };

const maxBodyBytes = 12_288;
const maxInputCharacters = 1_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const rateWindowMs = 60_000;
const rateMaxRequests = 60;

function json(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function requestKey(req: IncomingMessage) {
  return req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'local';
}

function rateLimitAllows(req: IncomingMessage) {
  const key = requestKey(req);
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + rateWindowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= rateMaxRequests;
}

function sameOriginAllows(req: IncomingMessage) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function sanitizeVoiceInput(input: string) {
  return input
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxInputCharacters);
}

export function normalizeAvatarVoicePayload(raw: unknown): AvatarVoicePayload | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  const provider = candidate.provider === undefined || candidate.provider === 'openai' ? 'openai' : undefined;
  const input = typeof candidate.input === 'string' ? sanitizeVoiceInput(candidate.input) : '';
  if (!provider || !input) return null;

  return {
    provider,
    input,
    voice: typeof candidate.voice === 'string' ? candidate.voice.slice(0, 40) : undefined
  };
}

async function readJson(req: IncomingMessage): Promise<ParsedRequest> {
  const chunks: Buffer[] = [];
  let bytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > maxBodyBytes) return { ok: false, status: 413, error: 'request_too_large' };
    chunks.push(buffer);
  }

  try {
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const parsed = rawBody ? JSON.parse(rawBody) : {};
    const payload = normalizeAvatarVoicePayload(parsed);
    if (!payload) return { ok: false, status: 400, error: 'invalid_payload' };
    return { ok: true, payload };
  } catch {
    return { ok: false, status: 400, error: 'invalid_json' };
  }
}

async function withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString('base64');
}

export function buildOpenAISpeechRequestBody(payload: AvatarVoicePayload) {
  return {
    model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    voice: payload.voice || process.env.OPENAI_TTS_VOICE || 'alloy',
    input: payload.input,
    instructions:
      process.env.OPENAI_TTS_INSTRUCTIONS ||
      'Speak in Korean with a warm, clear, calm teacher voice for a classroom demo.',
    response_format: 'mp3'
  };
}

async function audioResponseJson(res: ServerResponse, provider: AvatarVoiceProvider, response: Response) {
  const contentType = response.headers.get('content-type')?.split(';')[0] || 'audio/mpeg';
  const audioBase64 = toBase64(await response.arrayBuffer());
  json(res, 200, {
    provider,
    mimeType: contentType,
    audioBase64
  });
}

async function speakWithOpenAI(payload: AvatarVoicePayload, res: ServerResponse) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    json(res, 200, { error: 'openai_key_missing' });
    return;
  }

  try {
    const response = await withTimeout((signal) =>
      fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildOpenAISpeechRequestBody(payload))
      })
    );

    if (!response.ok) {
      json(res, 200, { error: `openai_tts_http_${response.status}` });
      return;
    }

    await audioResponseJson(res, 'openai', response);
  } catch {
    json(res, 200, { error: 'openai_tts_unavailable' });
  }
}

export async function avatarVoiceHandler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'method_not_allowed' });
    return;
  }

  if (!sameOriginAllows(req)) {
    json(res, 403, { error: 'origin_not_allowed' });
    return;
  }

  if (!rateLimitAllows(req)) {
    json(res, 429, { error: 'rate_limited' });
    return;
  }

  const parsed = await readJson(req);
  if (!parsed.ok) {
    json(res, parsed.status, { error: parsed.error });
    return;
  }

  await speakWithOpenAI(parsed.payload, res);
}
