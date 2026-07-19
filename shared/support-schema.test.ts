import { describe, expect, it } from 'vitest';
import { createSafePacket } from './fallback';
import { packetHasBannedLanguage, SupportPacketSchema, SupportRequestSchema } from './support-schema';

const request = SupportRequestSchema.parse({
  action: 'visual',
  scene: {
    jobTitle: 'Library Assistant',
    sceneTitle: 'Returning a book',
    description: 'A visitor returned a book.',
    question: 'Where should it go first?'
  }
});

describe('support safety contract', () => {
  it('produces a valid deterministic packet for every explicit action', () => {
    for (const action of ['visual', 'help', 'pause'] as const) {
      const packet = createSafePacket({ ...request, action });
      expect(SupportPacketSchema.safeParse(packet).success).toBe(true);
      expect(packet.safety).toEqual({
        noScoring: true,
        noDiagnosis: true,
        teacherReviewRequired: true
      });
    }
  });

  it('rejects evaluative or diagnostic language', () => {
    expect(packetHasBannedLanguage({
      ...createSafePacket(request),
      teacherSummary: 'This learner is the best fit for this job.'
    })).toBe(true);
  });

  it('accepts factual support language', () => {
    expect(packetHasBannedLanguage(createSafePacket(request))).toBe(false);
  });
});
