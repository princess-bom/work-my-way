import { createServer } from 'node:http';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  avatarVoiceHandler,
  buildOpenAISpeechRequestBody,
  createAvatarRealtimeSessionHandler,
  createAvatarVoiceHandler,
  normalizeAvatarVoicePayload
} from './avatarVoiceApi.ts';
import type { Queryable } from './db/client.ts';
import type { QueryResult, QueryResultRow } from 'pg';
import { createSessionToken, encryptSecret, hashToken, sessionCookie, signStudentToken } from './api/security.ts';

const originalEnv = {
  SESSION_SECRET: process.env.SESSION_SECRET,
  SERVER_ENCRYPTION_KEY: process.env.SERVER_ENCRYPTION_KEY,
  OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL,
  OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE,
  OPENAI_TTS_INSTRUCTIONS: process.env.OPENAI_TTS_INSTRUCTIONS,
  OPENAI_REALTIME_MODEL: process.env.OPENAI_REALTIME_MODEL,
  OPENAI_REALTIME_VOICE: process.env.OPENAI_REALTIME_VOICE,
  OPENAI_REALTIME_INSTRUCTIONS: process.env.OPENAI_REALTIME_INSTRUCTIONS
};
const dbSessionId = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  vi.restoreAllMocks();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

function rows<T extends QueryResultRow>(items: T[]): QueryResult<T> {
  return {
    command: 'SELECT',
    rowCount: items.length,
    oid: 0,
    fields: [],
    rows: items
  };
}

function row<T extends QueryResultRow>(item: QueryResultRow): T {
  return item as unknown as T;
}

class AvatarVoiceDb implements Queryable {
  readonly session = {
    id: dbSessionId,
    school_id: 'school-1',
    class_id: 'class-1',
    student_id: 'student-1'
  };
  readonly teacherSessionToken = createSessionToken();
  readonly teacher = {
    id: 'teacher-1',
    school_id: 'school-1',
    role: 'admin',
    display_name: '담당 교사'
  };
  providerEnabled = true;
  encryptedApiKey: string | null = encryptSecret('decrypted-school-openai-key', 'avatar-test-encryption-secret');
  seenTeacherSessionRefresh = false;

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

    if (normalized.includes('from exploration_sessions')) {
      return params[0] === this.session.id ? rows([row<T>(this.session)]) : rows([]);
    }
    if (normalized.includes('from teacher_sessions ts')) {
      return params[0] === hashToken(this.teacherSessionToken) ? rows([row<T>(this.teacher)]) : rows([]);
    }
    if (normalized.includes('from classes c')) {
      return params[0] === this.session.class_id && params[1] === this.session.school_id ? rows([row<T>({ id: this.session.class_id })]) : rows([]);
    }
    if (normalized.startsWith('update teacher_sessions set last_seen_at')) {
      this.seenTeacherSessionRefresh = true;
      return rows([]);
    }
    if (normalized.includes('from voice_provider_settings')) {
      if (!this.providerEnabled || !this.encryptedApiKey) return rows([]);
      return rows([
        row<T>({
          provider: 'openai_tts',
          model: 'settings-model',
          voice: 'settings-voice',
          encrypted_api_key: this.encryptedApiKey
        })
      ]);
    }

    throw new Error(`Unhandled query in AvatarVoiceDb: ${text}`);
  }
}

describe('avatar voice api', () => {
  it('normalizes OpenAI voice requests without requiring client-side secrets', () => {
    const payload = normalizeAvatarVoicePayload({
      provider: 'openai',
      input: '  오늘은\n바리스타의 하루를   살펴볼게요.  ',
      voice: 'alloy',
      sessionId: 'session-1',
      studentToken: 'student-token'
    });

    expect(payload).toEqual({
      provider: 'openai',
      input: '오늘은 바리스타의 하루를 살펴볼게요.',
      voice: 'alloy',
      schoolId: undefined,
      sessionId: 'session-1',
      studentToken: 'student-token'
    });
    expect(normalizeAvatarVoicePayload({ provider: 'higgs', input: '안녕' })).toBeNull();
  });

  it('builds the same OpenAI TTS request shape used by the reference app', () => {
    process.env.OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
    process.env.OPENAI_TTS_VOICE = 'marin';
    process.env.OPENAI_TTS_INSTRUCTIONS = '한국어로 차분하고 또렷하게 읽어주세요.';

    expect(
      buildOpenAISpeechRequestBody({
        provider: 'openai',
        input: '천천히 들어볼게요.'
      })
    ).toEqual({
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      input: '천천히 들어볼게요.',
      instructions: '한국어로 차분하고 또렷하게 읽어주세요.',
      response_format: 'mp3'
    });
  });

  it('rejects unauthenticated no-origin POSTs before provider lookup', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const server = createServer(avatarVoiceHandler);

    const response = await request(server)
      .post('/api/avatar/speak')
      .send({ provider: 'openai', input: '천천히 들어볼게요.', voice: 'alloy' })
      .expect(401);

    expect(response.body).toEqual({ error: 'session_context_required' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated session-scoped POSTs before database or provider lookup', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const server = createServer(avatarVoiceHandler);

    const response = await request(server)
      .post('/api/avatar/speak')
      .send({ provider: 'openai', input: '천천히 들어볼게요.', voice: 'alloy', sessionId: 'session-1' })
      .expect(401);

    expect(response.body).toEqual({ error: 'session_access_required' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects local/demo session identifiers before database or provider lookup', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const db: Queryable = {
      async query() {
        throw new Error('database should not be queried for non-uuid avatar session ids');
      }
    };
    const server = createServer(createAvatarVoiceHandler({ db }));

    const response = await request(server)
      .post('/api/avatar/speak')
      .set('x-student-context', 'present-but-not-verified-before-session-id-shape')
      .send({ provider: 'openai', input: '천천히 들어볼게요.', voice: 'alloy', sessionId: 'local-session-student-1' })
      .expect(403);

    expect(response.body).toEqual({ error: 'session_access_denied' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps unexpected handler failures as JSON responses for raw middleware hosts', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db: Queryable = {
      async query() {
        throw new Error('database unavailable');
      }
    };
    const server = createServer(createAvatarVoiceHandler({ db }));

    const response = await request(server)
      .post('/api/avatar/speak')
      .set('x-student-context', 'present-but-db-will-fail')
      .send({ provider: 'openai', input: '천천히 들어볼게요.', voice: 'alloy', sessionId: '11111111-1111-4111-8111-111111111111' })
      .expect(500);

    expect(response.type).toBe('application/json');
    expect(response.body).toEqual({ error: 'internal_error' });
    expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('rejects a student token bound to a different session', async () => {
    process.env.SESSION_SECRET = 'avatar-test-session-secret';
    const db = new AvatarVoiceDb();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const otherSessionToken = signStudentToken({ schoolId: 'school-1', classId: 'class-1', studentId: 'student-2' });
    const server = createServer(createAvatarVoiceHandler({ db }));

    const response = await request(server)
      .post('/api/avatar/speak')
      .set('x-student-context', otherSessionToken)
      .send({ provider: 'openai', input: '천천히 들어볼게요.', voice: 'alloy', sessionId: dbSessionId })
      .expect(403);

    expect(response.body).toEqual({ error: 'session_access_denied' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns a safe fallback signal instead of calling OpenAI when provider settings are disabled', async () => {
    process.env.SESSION_SECRET = 'avatar-test-session-secret';
    process.env.SERVER_ENCRYPTION_KEY = 'avatar-test-encryption-secret';
    const db = new AvatarVoiceDb();
    db.providerEnabled = false;
    const studentToken = signStudentToken({ schoolId: 'school-1', classId: 'class-1', studentId: 'student-1' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const server = createServer(createAvatarVoiceHandler({ db }));

    const response = await request(server)
      .post('/api/avatar/speak')
      .set('x-student-context', studentToken)
      .send({ provider: 'openai', input: '천천히 들어볼게요.', voice: 'alloy', sessionId: dbSessionId })
      .expect(200);

    expect(response.body).toEqual({ error: 'voice_provider_not_configured_or_disabled' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls OpenAI for a session-bound student using the decrypted school provider key', async () => {
    process.env.SESSION_SECRET = 'avatar-test-session-secret';
    process.env.SERVER_ENCRYPTION_KEY = 'avatar-test-encryption-secret';
    const db = new AvatarVoiceDb();
    const studentToken = signStudentToken({ schoolId: 'school-1', classId: 'class-1', studentId: 'student-1' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' }
      })
    );
    const server = createServer(createAvatarVoiceHandler({ db }));

    const response = await request(server)
      .post('/api/avatar/speak')
      .set('x-student-context', studentToken)
      .send({ provider: 'openai', input: '천천히 들어볼게요.', sessionId: dbSessionId })
      .expect(200);

    expect(response.body).toEqual({
      provider: 'openai',
      mimeType: 'audio/mpeg',
      audioBase64: 'AQID'
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer decrypted-school-openai-key' });
    expect(init?.body).toBe(
      JSON.stringify({
        model: 'settings-model',
        voice: 'settings-voice',
        input: '천천히 들어볼게요.',
        instructions: 'Speak in Korean with a warm, clear, calm teacher voice for a classroom demo.',
        response_format: 'mp3'
      })
    );
  });

  it('allows an authorized teacher session for the supplied avatar session', async () => {
    process.env.SERVER_ENCRYPTION_KEY = 'avatar-test-encryption-secret';
    const db = new AvatarVoiceDb();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([4, 5, 6]), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' }
      })
    );
    const server = createServer(createAvatarVoiceHandler({ db }));

    await request(server)
      .post('/api/avatar/speak')
      .set('Cookie', sessionCookie(db.teacherSessionToken, new Date(Date.now() + 60_000)))
      .send({ provider: 'openai', input: '교사 세션으로 들어볼게요.', sessionId: dbSessionId })
      .expect(200);

    expect(db.seenTeacherSessionRefresh).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('creates an OpenAI realtime SDP answer using the decrypted school provider key', async () => {
    process.env.SESSION_SECRET = 'avatar-test-session-secret';
    process.env.SERVER_ENCRYPTION_KEY = 'avatar-test-encryption-secret';
    const db = new AvatarVoiceDb();
    const studentToken = signStudentToken({ schoolId: 'school-1', classId: 'class-1', studentId: 'student-1' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('answer-sdp', {
        status: 200,
        headers: { 'content-type': 'application/sdp' }
      })
    );
    const server = createServer(createAvatarRealtimeSessionHandler({ db }));

    const response = await request(server)
      .post('/api/avatar/realtime-session')
      .set('content-type', 'application/sdp')
      .set('x-avatar-session-id', dbSessionId)
      .set('x-student-context', studentToken)
      .send('offer-sdp')
      .expect(200);

    expect(response.type).toBe('application/sdp');
    expect(response.text).toBe('answer-sdp');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/realtime/calls');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer decrypted-school-openai-key' });
    const form = init?.body as FormData;
    expect(form.get('sdp')).toBe('offer-sdp');
    const session = JSON.parse(String(form.get('session')));
    expect(session).toMatchObject({
      type: 'realtime',
      model: 'gpt-realtime-2',
      audio: {
        output: { voice: 'settings-voice' },
        input: {
          turn_detection: { type: 'server_vad' },
          transcription: { model: 'gpt-4o-mini-transcribe', language: 'ko' }
        }
      }
    });
  });

  it('rejects local/demo realtime session identifiers before provider lookup', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const db: Queryable = {
      async query() {
        throw new Error('database should not be queried for non-uuid realtime session ids');
      }
    };
    const server = createServer(createAvatarRealtimeSessionHandler({ db }));

    const response = await request(server)
      .post('/api/avatar/realtime-session')
      .set('content-type', 'application/sdp')
      .set('x-avatar-session-id', 'local-session-student-1')
      .set('x-student-context', 'present-but-not-verified-before-session-id-shape')
      .send('offer-sdp')
      .expect(403);

    expect(response.body).toEqual({ error: 'session_access_denied' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
