import { describe, expect, it, vi } from 'vitest';
import { createSupportPacket } from './support-service';
import type { SupportRequest } from '../shared/support-schema';

const request: SupportRequest = {
  action: 'visual',
  scene: {
    jobTitle: 'Library Assistant',
    sceneTitle: 'Returning a book',
    description: 'A visitor returned a book.',
    question: 'Where should it go first?'
  },
  goalContext: {
    targetSkill: 'Follow a two-step workplace routine',
    observableCriterion: 'Completes both observable steps with visual choices'
  },
  supportContext: {
    currentSupport: 'visual_choice',
    recentOutcome: 'criterion_not_met'
  }
};

const safeModelPacket = {
  studentMessage: 'Let’s look at two clear choices.',
  studentChoices: [
    { label: 'Check the return cart', visualCue: 'A cart of returned books' },
    { label: 'Match the shelf label', visualCue: 'A label on the bookshelf' }
  ],
  recommendedSupport: 'visual_choices',
  teacherSignal: 'explicit_visual_request',
  teacherSummary: 'The learner selected Show me during the library scene.',
  teacherNextStep: 'Review the two visual choices with the learner.',
  evidence: 'Based only on the learner selecting Show me in the current scene.',
  safety: { noScoring: true, noDiagnosis: true, teacherReviewRequired: true }
};

describe('GPT-5.6 support service', () => {
  it('returns a live structured packet from a valid model response', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'resp_demo',
      output_text: JSON.stringify(safeModelPacket)
    });
    const result = await createSupportPacket(request, {
      model: 'gpt-5.6-luna',
      client: { responses: { create } }
    });

    expect(result.generation.mode).toBe('live');
    expect(result.generation.responseId).toBe('resp_demo');
    expect(result.safety.teacherReviewRequired).toBe(true);
    expect(create).toHaveBeenCalledOnce();
    const modelInput = JSON.parse(create.mock.calls[0][0].input as string);
    expect(modelInput).toMatchObject({
      goalContext: request.goalContext,
      supportContext: request.supportContext
    });
    expect(JSON.stringify(modelInput)).not.toMatch(/learnerId|profileId|diagnosis|iepText/i);
  });

  it('uses a clearly labeled safe fallback when no API key exists', async () => {
    const result = await createSupportPacket(request, { apiKey: '' });
    expect(result.generation.mode).toBe('safe-fallback');
    expect(result.generation.reason).toContain('not configured');
  });

  it('blocks prohibited model language and falls back safely', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'resp_bad',
      output_text: JSON.stringify({
        ...safeModelPacket,
        teacherSummary: 'The learner is the best fit for this job.'
      })
    });
    const result = await createSupportPacket(request, {
      client: { responses: { create } }
    });

    expect(result.generation.mode).toBe('safe-fallback');
    expect(result.generation.reason).toContain('prohibited evaluative language');
    expect(result.teacherSummary).not.toContain('best fit');
  });

  it('blocks model claims about mastery and falls back safely', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'resp_mastery_claim',
      output_text: JSON.stringify({
        ...safeModelPacket,
        teacherSummary: 'The learner has mastered this skill.'
      })
    });
    const result = await createSupportPacket(request, { client: { responses: { create } } });
    expect(result.generation.mode).toBe('safe-fallback');
    expect(result.teacherSummary).not.toContain('mastered');
  });
});
