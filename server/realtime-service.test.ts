import { describe, expect, it, vi } from 'vitest';
import { createRealtimeClientSecret, REALTIME_INSTRUCTIONS, REALTIME_MODEL } from './realtime-service';

describe('realtime session service', () => {
  it('mints a bounded mini-model client secret without exposing the standard key', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe('Bearer server-secret');
      expect(headers.get('OpenAI-Safety-Identifier')).toMatch(/^[a-f0-9]{64}$/);
      const body = JSON.parse(String(init?.body));
      expect(body.session.model).toBe(REALTIME_MODEL);
      expect(body.session.instructions).toContain('점수');
      return new Response(JSON.stringify({ value: 'ek_test_synthetic_value_12345' }), { status: 200 });
    });

    const result = await createRealtimeClientSecret(
      { runId: '26f83d61-cc0b-4f68-9445-6dc82fb807c3' },
      { apiKey: 'server-secret', fetchImpl, validateRun: async () => undefined }
    );
    expect(result.value).toBe('ek_test_synthetic_value_12345');
    expect(JSON.stringify(result)).not.toContain('server-secret');
  });

  it('keeps the student conversation inside the current learning scene', () => {
    expect(REALTIME_INSTRUCTIONS).toContain('현재 화면');
    expect(REALTIME_INSTRUCTIONS).toContain('면접 연습으로 넘어가지 않습니다');
    expect(REALTIME_INSTRUCTIONS).toContain('개인 정보');
  });
});
