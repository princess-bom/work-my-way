import { describe, expect, it } from 'vitest';
import { supportHttpResponse } from './http';

describe('support HTTP boundary', () => {
  it('rejects malformed requests without invoking generation', async () => {
    const response = await supportHttpResponse({ action: 'score-me' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'invalid_request' });
  });

  it('returns a safe packet for a valid request without a server key', async () => {
    const response = await supportHttpResponse({
      action: 'help',
      scene: {
        jobTitle: 'Library Assistant',
        sceneTitle: 'Returning a book',
        description: 'A visitor returned a book.',
        question: 'Where should it go first?'
      }
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      generation: { mode: 'safe-fallback' },
      safety: { teacherReviewRequired: true }
    });
  });
});
