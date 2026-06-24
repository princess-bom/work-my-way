import type { IncomingMessage, ServerResponse } from 'node:http';
import { getPool, type Queryable } from './db/client.js';
import { decryptSecret, hashToken, parseCookies, teacherSessionCookieName, verifyStudentToken } from './api/security.js';

type AvatarVoiceProvider = 'openai';

export type AvatarVoicePayload = {
  provider: AvatarVoiceProvider;
  input: string;
  voice?: string;
  schoolId?: string;
  sessionId?: string;
  studentToken?: string;
};

type ParsedRequest =
  | { ok: true; payload: AvatarVoicePayload }
  | { ok: false; status: number; error: string };

type OpenAIVoiceProviderSetting = {
  provider: 'openai_tts';
  model: string | null;
  voice: string | null;
  encrypted_api_key: string;
};

export type VoiceProviderGate =
  | { enabled: true; setting: OpenAIVoiceProviderSetting }
  | { enabled: false; reason: 'voice_provider_context_missing' | 'voice_provider_not_configured_or_disabled' };

type AvatarVoiceHandlerOptions = {
  db?: Queryable;
  resolveVoiceProviderGate?: (schoolId: string, payload: AvatarVoicePayload) => Promise<VoiceProviderGate>;
};

const maxBodyBytes = 12_288;
const maxRealtimeSdpBytes = 65_536;
const maxInputCharacters = 1_000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const rateWindowMs = 60_000;
const rateMaxRequests = 60;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function optionalIdentifier(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : undefined;
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
    voice: typeof candidate.voice === 'string' ? candidate.voice.slice(0, 40) : undefined,
    schoolId: optionalIdentifier(candidate.schoolId),
    sessionId: optionalIdentifier(candidate.sessionId),
    studentToken: typeof candidate.studentToken === 'string' ? candidate.studentToken : undefined
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

async function readSdpOffer(req: IncomingMessage): Promise<{ ok: true; sdp: string } | { ok: false; status: number; error: string }> {
  const chunks: Buffer[] = [];
  let bytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > maxRealtimeSdpBytes) return { ok: false, status: 413, error: 'request_too_large' };
    chunks.push(buffer);
  }

  const sdp = Buffer.concat(chunks).toString('utf8').trim();
  if (!sdp) return { ok: false, status: 400, error: 'invalid_sdp' };
  return { ok: true, sdp };
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

export function buildOpenAISpeechRequestBody(payload: AvatarVoicePayload, setting?: OpenAIVoiceProviderSetting) {
  return {
    model: setting?.model || process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    voice: payload.voice || setting?.voice || process.env.OPENAI_TTS_VOICE || 'alloy',
    input: payload.input,
    instructions:
      process.env.OPENAI_TTS_INSTRUCTIONS ||
      'Speak in Korean with a warm, clear, calm teacher voice for a classroom demo.',
    response_format: 'mp3'
  };
}

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString('base64');
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

function isExpectedOpenAITtsFailure(error: unknown) {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError' || error.name === 'TimeoutError';
  }
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || error.name === 'TimeoutError' || error.name === 'TypeError' || error.name === 'FetchError';
}

function readStudentToken(req: IncomingMessage, payload: AvatarVoicePayload) {
  const headerToken = req.headers['x-student-context']?.toString();
  if (headerToken) return headerToken;
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Student ')) return authorization.slice('Student '.length);
  return payload.studentToken;
}

function readAvatarSessionId(req: IncomingMessage) {
  const headerSessionId = req.headers['x-avatar-session-id']?.toString();
  if (headerSessionId) return optionalIdentifier(headerSessionId);
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    return optionalIdentifier(url.searchParams.get('sessionId'));
  } catch {
    return undefined;
  }
}

function isUuid(value: string | undefined) {
  return Boolean(value && uuidPattern.test(value));
}

function hasAvatarVoiceCredential(req: IncomingMessage, payload: AvatarVoicePayload) {
  return Boolean(parseCookies(req.headers.cookie).get(teacherSessionCookieName) || readStudentToken(req, payload));
}

async function authenticateTeacherForSession(db: Queryable, req: IncomingMessage, session: { school_id: string; class_id: string }) {
  const token = parseCookies(req.headers.cookie).get(teacherSessionCookieName);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const teacher = await db.query<{ id: string; school_id: string; role: 'admin' | 'teacher' | 'support_staff'; display_name: string }>(
    `
      select ta.id, ta.school_id, ta.role, ta.display_name
      from teacher_sessions ts
      join teacher_accounts ta on ta.id = ts.teacher_id
      where ts.token_hash = $1 and ts.revoked_at is null and ts.expires_at > now() and ta.active = true
      limit 1
    `,
    [tokenHash]
  );
  const row = teacher.rows[0];
  if (!row || row.school_id !== session.school_id) return null;

  const access = await db.query<{ id: string }>(
    `
      select c.id
      from classes c
      where c.id = $1 and c.school_id = $2 and c.active = true and (
        $3::boolean
        or exists (
          select 1 from class_teacher_memberships ctm
          where ctm.class_id = c.id and ctm.teacher_id = $4 and ctm.active = true
        )
      )
      limit 1
    `,
    [session.class_id, row.school_id, row.role === 'admin', row.id]
  );
  if (!access.rows[0]) return null;
  await db.query('update teacher_sessions set last_seen_at = now() where token_hash = $1', [tokenHash]);
  return row;
}

async function authenticateAvatarVoiceRequest(req: IncomingMessage, payload: AvatarVoicePayload, db: Queryable) {
  if (!payload.sessionId) return { ok: false as const, status: 401, error: 'session_context_required' };
  if (!isUuid(payload.sessionId)) return { ok: false as const, status: 403, error: 'session_access_denied' };
  const session = await db.query<{ school_id: string; class_id: string; student_id: string }>(
    'select school_id, class_id, student_id from exploration_sessions where id = $1 limit 1',
    [payload.sessionId]
  );
  const row = session.rows[0];
  if (!row) return { ok: false as const, status: 403, error: 'session_access_denied' };

  const teacher = await authenticateTeacherForSession(db, req, row);
  if (teacher) return { ok: true as const, schoolId: row.school_id };

  const rawStudentToken = readStudentToken(req, payload);
  if (!rawStudentToken) return { ok: false as const, status: 401, error: 'session_access_required' };
  const studentToken = verifyStudentToken(rawStudentToken);
  if (!studentToken) return { ok: false as const, status: 401, error: 'session_access_required' };
  if (studentToken.schoolId !== row.school_id || studentToken.classId !== row.class_id || studentToken.studentId !== row.student_id) {
    return { ok: false as const, status: 403, error: 'session_access_denied' };
  }
  return { ok: true as const, schoolId: row.school_id };
}

async function resolveVoiceProviderGate(schoolId: string, _payload: AvatarVoicePayload, db?: Queryable): Promise<VoiceProviderGate> {
  const activeDb = db ?? getPool();
  const result = await activeDb.query<OpenAIVoiceProviderSetting>(
    `
      select provider, model, voice, encrypted_api_key
      from voice_provider_settings
      where school_id = $1 and provider = 'openai_tts' and enabled = true and encrypted_api_key is not null
      order by updated_at desc
      limit 1
    `,
    [schoolId]
  );
  const setting = result.rows[0];
  if (!setting) return { enabled: false, reason: 'voice_provider_not_configured_or_disabled' };
  return { enabled: true, setting };
}

async function speakWithOpenAI(payload: AvatarVoicePayload, res: ServerResponse, schoolId: string, resolveGate: (schoolId: string, payload: AvatarVoicePayload) => Promise<VoiceProviderGate>) {
  const gate = await resolveGate(schoolId, payload);
  if (gate.enabled === false) {
    json(res, 200, { error: gate.reason });
    return;
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(gate.setting.encrypted_api_key);
  } catch {
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
        body: JSON.stringify(buildOpenAISpeechRequestBody(payload, gate.setting))
      })
    );

    if (!response.ok) {
      json(res, 200, { error: `openai_tts_http_${response.status}` });
      return;
    }

    await audioResponseJson(res, 'openai', response);
  } catch (error) {
    if (!isExpectedOpenAITtsFailure(error)) throw error;
    json(res, 200, { error: 'openai_tts_unavailable' });
  }
}

export function buildOpenAIRealtimeSessionConfig(setting?: OpenAIVoiceProviderSetting) {
  return {
    type: 'realtime',
    model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2',
    instructions:
      process.env.OPENAI_REALTIME_INSTRUCTIONS ||
      'You are Eiden, a warm Korean classroom avatar coach. Speak Korean clearly, keep turns short, and help the student explore the current job scene without scoring or judging.',
    audio: {
      output: {
        voice: process.env.OPENAI_REALTIME_VOICE || setting?.voice || process.env.OPENAI_TTS_VOICE || 'marin'
      }
    }
  };
}

async function createRealtimeSessionWithOpenAI(
  offerSdp: string,
  res: ServerResponse,
  schoolId: string,
  payload: AvatarVoicePayload,
  resolveGate: (schoolId: string, payload: AvatarVoicePayload) => Promise<VoiceProviderGate>
) {
  const gate = await resolveGate(schoolId, payload);
  if (gate.enabled === false) {
    json(res, 200, { error: gate.reason });
    return;
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(gate.setting.encrypted_api_key);
  } catch {
    json(res, 200, { error: 'openai_key_missing' });
    return;
  }

  const form = new FormData();
  form.set('sdp', offerSdp);
  form.set('session', JSON.stringify(buildOpenAIRealtimeSessionConfig(gate.setting)));

  try {
    const response = await withTimeout((signal) =>
      fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'OpenAI-Safety-Identifier': hashToken(`${schoolId}:${payload.sessionId}`)
        },
        body: form
      })
    );

    if (!response.ok) {
      json(res, 200, { error: `openai_realtime_http_${response.status}` });
      return;
    }

    const answerSdp = await response.text();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/sdp');
    res.end(answerSdp);
  } catch (error) {
    if (!isExpectedOpenAITtsFailure(error)) throw error;
    json(res, 200, { error: 'openai_realtime_unavailable' });
  }
}

export function createAvatarVoiceHandler(options: AvatarVoiceHandlerOptions = {}) {
  const getDb = () => options.db ?? getPool();
  const resolveGate = options.resolveVoiceProviderGate ?? ((schoolId: string, payload: AvatarVoicePayload) => resolveVoiceProviderGate(schoolId, payload, getDb()));

  return async function avatarVoiceHandler(req: IncomingMessage, res: ServerResponse) {
    try {
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
      if (parsed.ok === false) {
        json(res, parsed.status, { error: parsed.error });
        return;
      }

      if (!parsed.payload.sessionId) {
        json(res, 401, { error: 'session_context_required' });
        return;
      }
      if (!hasAvatarVoiceCredential(req, parsed.payload)) {
        json(res, 401, { error: 'session_access_required' });
        return;
      }

      const auth = await authenticateAvatarVoiceRequest(req, parsed.payload, getDb());
      if (!auth.ok) {
        json(res, auth.status, { error: auth.error });
        return;
      }

      await speakWithOpenAI(parsed.payload, res, auth.schoolId, resolveGate);
    } catch (error) {
      console.error(error);
      json(res, 500, { error: 'internal_error' });
    }
  };
}

export const avatarVoiceHandler = createAvatarVoiceHandler();

export function createAvatarRealtimeSessionHandler(options: AvatarVoiceHandlerOptions = {}) {
  const getDb = () => options.db ?? getPool();
  const resolveGate = options.resolveVoiceProviderGate ?? ((schoolId: string, payload: AvatarVoicePayload) => resolveVoiceProviderGate(schoolId, payload, getDb()));

  return async function avatarRealtimeSessionHandler(req: IncomingMessage, res: ServerResponse) {
    try {
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

      const payload: AvatarVoicePayload = {
        provider: 'openai',
        input: 'realtime',
        sessionId: readAvatarSessionId(req)
      };

      if (!payload.sessionId) {
        json(res, 401, { error: 'session_context_required' });
        return;
      }
      if (!hasAvatarVoiceCredential(req, payload)) {
        json(res, 401, { error: 'session_access_required' });
        return;
      }

      const sdp = await readSdpOffer(req);
      if (sdp.ok === false) {
        json(res, sdp.status, { error: sdp.error });
        return;
      }

      const auth = await authenticateAvatarVoiceRequest(req, payload, getDb());
      if (!auth.ok) {
        json(res, auth.status, { error: auth.error });
        return;
      }

      await createRealtimeSessionWithOpenAI(sdp.sdp, res, auth.schoolId, payload, resolveGate);
    } catch (error) {
      console.error(error);
      json(res, 500, { error: 'internal_error' });
    }
  };
}

export const avatarRealtimeSessionHandler = createAvatarRealtimeSessionHandler();
