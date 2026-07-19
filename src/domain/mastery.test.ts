import { describe, expect, it } from 'vitest';
import { evaluateMastery, type MasteryAttempt, type MasteryDecision } from './mastery';

const goalId = 'goal-work-routine';

function attempt(
  id: string,
  sessionId: string,
  criterionMet: boolean,
  supportLevel: MasteryAttempt['supportLevel'] = 'visual_choice'
): MasteryAttempt {
  return {
    id,
    goalId,
    sessionId,
    occurredAt: `2026-07-${id.padStart(2, '0')}T09:00:00.000Z`,
    criterionMet,
    supportLevel
  };
}

describe('evaluateMastery', () => {
  it('keeps progress when attempts are not consecutive qualifying evidence', () => {
    expect(evaluateMastery(goalId, [attempt('1', 'a', true), attempt('2', 'b', false)], [])).toEqual({
      status: 'in_progress',
      evidenceAttemptIds: null
    });
  });

  it('requires qualifying attempts from distinct sessions', () => {
    expect(evaluateMastery(goalId, [attempt('1', 'a', true), attempt('2', 'a', true)], []).status)
      .toBe('in_progress');
  });

  it('does not accept support above visual choice', () => {
    expect(evaluateMastery(
      goalId,
      [attempt('1', 'a', true), attempt('2', 'b', true, 'verbal_prompt')],
      []
    ).status).toBe('in_progress');
  });

  it('becomes ready after two consecutive qualifying attempts', () => {
    expect(evaluateMastery(goalId, [attempt('1', 'a', true), attempt('2', 'b', true)], [])).toEqual({
      status: 'ready_for_teacher_review',
      evidenceAttemptIds: ['1', '2']
    });
  });

  it('uses the two most recent attempts as the current evidence streak', () => {
    expect(evaluateMastery(goalId, [
      attempt('1', 'a', true),
      attempt('2', 'b', true),
      attempt('3', 'c', false)
    ], []).status).toBe('in_progress');
  });

  it('requires the latest teacher decision to confirm the qualifying evidence', () => {
    const attempts = [attempt('1', 'a', true), attempt('2', 'b', true)];
    const confirmation: MasteryDecision = {
      goalId,
      decidedAt: '2026-07-03T09:00:00.000Z',
      decision: 'confirm_mastery',
      evidenceAttemptIds: ['1', '2']
    };
    expect(evaluateMastery(goalId, attempts, [confirmation]).status).toBe('mastered');
    expect(evaluateMastery(goalId, attempts, [
      { ...confirmation, decidedAt: '2026-07-01T08:00:00.000Z' }
    ]).status).toBe('ready_for_teacher_review');
    expect(evaluateMastery(goalId, attempts, [
      confirmation,
      { ...confirmation, decidedAt: '2026-07-04T09:00:00.000Z', decision: 'continue_instruction' }
    ]).status).toBe('ready_for_teacher_review');
  });
});
