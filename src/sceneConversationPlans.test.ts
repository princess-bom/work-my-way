import { describe, expect, it } from 'vitest';
import { jobs } from './data';
import { sceneConversationPlans } from './sceneConversationPlans';

const plannedTurnPurposes = ['observe', 'meaning', 'practice_or_support'] as const;

describe('scene conversation plans', () => {
  it('covers every current scene with three planned turns and teacher guidance', () => {
    let sceneCount = 0;
    let turnCount = 0;

    for (const job of jobs) {
      for (const scene of job.scenes) {
        sceneCount += 1;
        const plan = sceneConversationPlans[job.id]?.[scene.id];

        expect(plan, `${job.id}/${scene.id}`).toBeDefined();
        expect(plan.deliveredInfo.length, `${job.id}/${scene.id} deliveredInfo`).toBeGreaterThan(0);
        expect(plan.deliveredInfo.every((item) => item.trim().length > 0)).toBe(true);
        expect(plan.teacherNextGuidance.trim().length, `${job.id}/${scene.id} teacherNextGuidance`).toBeGreaterThan(0);
        expect(plan.turns.map((turn) => turn.purpose)).toEqual(plannedTurnPurposes);
        expect(plan.turns).toHaveLength(3);
        turnCount += plan.turns.length;
      }
    }

    expect(sceneCount).toBe(12);
    expect(turnCount).toBe(36);
  });

  it('keeps every planned student response compatible with current scene AAC options', () => {
    for (const job of jobs) {
      for (const scene of job.scenes) {
        const sceneOptionIds = new Set((scene.aacOptions ?? []).map((option) => option.id));
        const plan = sceneConversationPlans[job.id]?.[scene.id];

        expect(plan, `${job.id}/${scene.id}`).toBeDefined();
        expect(plan.aacOptionIds.length, `${job.id}/${scene.id} aacOptionIds`).toBeGreaterThan(0);
        expect(plan.aacOptionIds.every((optionId) => sceneOptionIds.has(optionId))).toBe(true);

        for (const turn of plan.turns) {
          expect(turn.voiceScript.trim().length, `${job.id}/${scene.id} voiceScript`).toBeGreaterThan(0);
          expect(turn.displayText.trim().length, `${job.id}/${scene.id} displayText`).toBeGreaterThan(0);
          expect(turn.studentQuestion.trim().length, `${job.id}/${scene.id} studentQuestion`).toBeGreaterThan(0);
          expect(turn.expectedResponseOptionIds.length, `${job.id}/${scene.id} expectedResponseOptionIds`).toBeGreaterThan(0);
          expect(turn.expectedResponseOptionIds.every((optionId) => sceneOptionIds.has(optionId))).toBe(true);
        }
      }
    }
  });

  it('includes practice, evidence, and support data for each scene plan', () => {
    for (const job of jobs) {
      for (const scene of job.scenes) {
        const plan = sceneConversationPlans[job.id]?.[scene.id];

        expect(plan.practiceStep.studentAction.trim().length, `${job.id}/${scene.id} practiceStep`).toBeGreaterThan(0);
        expect(plan.practiceStep.supportIfNeeded.trim().length, `${job.id}/${scene.id} practice support`).toBeGreaterThan(0);
        expect(plan.evidenceCandidate.trim().length, `${job.id}/${scene.id} evidenceCandidate`).toBeGreaterThan(0);
        expect(plan.supportFallback.trim().length, `${job.id}/${scene.id} supportFallback`).toBeGreaterThan(0);
      }
    }
  });
});
