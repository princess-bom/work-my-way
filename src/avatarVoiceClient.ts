export type AvatarSpeechAudio = {
  url: string;
  mimeType: string;
  provider: 'openai';
  audioBase64: string;
};

type AvatarSpeechApiResponse = {
  provider?: 'openai';
  mimeType?: string;
  audioBase64?: string;
  error?: string;
};

const avatarSpeechTimeoutMs = 24_000;

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), avatarSpeechTimeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function base64ToBlobUrl(audioBase64: string, mimeType: string) {
  const binary = window.atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export async function requestAvatarSpeech(input: string, voice = 'alloy'): Promise<AvatarSpeechAudio> {
  const response = await fetchWithTimeout('/api/avatar/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, provider: 'openai', voice })
  });
  const body = (await response.json()) as AvatarSpeechApiResponse;

  if (!response.ok || !body.audioBase64) {
    throw new Error(body.error || `avatar_voice_http_${response.status}`);
  }

  const mimeType = body.mimeType || 'audio/mpeg';
  return {
    url: base64ToBlobUrl(body.audioBase64, mimeType),
    mimeType,
    provider: body.provider || 'openai',
    audioBase64: body.audioBase64
  };
}
