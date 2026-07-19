import { afterEach, describe, expect, it } from 'vitest';
import { createDemoService } from './demo-service';

const services: ReturnType<typeof createDemoService>[] = [];

function memoryService() {
  const service = createDemoService({
    databaseUrl: null,
    now: () => new Date('2026-07-19T09:00:00.000Z')
  });
  services.push(service);
  return service;
}

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.close()));
});

describe('synthetic demo service', () => {
  it('starts an isolated 24-hour run without real learner data', async () => {
    const service = memoryService();
    const run = await service.start();
    expect(run.persistence).toBe('memory_fallback');
    expect(run.state.synthetic).toBe(true);
    expect(run.state.profiles.every((profile) => profile.synthetic)).toBe(true);
    expect(run.expiresAt).toBe('2026-07-20T09:00:00.000Z');
  });

  it('computes review readiness on the server from two qualifying sessions', async () => {
    const service = memoryService();
    const run = await service.start();
    const result = await service.recordAttempt(run.runId, {
      id: 'attempt-current-qualifying',
      selectedChoiceId: 'return-cart',
      supportRequest: 'show'
    });
    expect(result.mastery.status).toBe('ready_for_teacher_review');
    expect(result.mastery.evidenceAttemptIds).toEqual(['attempt-2', 'attempt-current-qualifying']);
  });

  it('derives criterion, support, session, and observation from the submitted choice', async () => {
    const service = memoryService();
    const run = await service.start();
    const result = await service.recordAttempt(run.runId, {
      id: 'attempt-current-not-yet',
      selectedChoiceId: 'shelf-now',
      supportRequest: null
    });
    const stored = result.state.attempts.at(-1)!;

    expect(stored).toMatchObject({
      id: 'attempt-current-not-yet',
      goalId: run.state.goals[0].id,
      sessionId: run.state.sessions[2].id,
      criterionMet: false,
      supportLevel: 'none',
      selectedChoiceId: 'shelf-now',
      observation: 'step_not_yet_completed'
    });
    expect(stored.occurredAt).toBe('2026-07-19T09:00:00.000Z');
    expect(result.mastery.status).toBe('in_progress');
  });

  it('maps a help request to verbal support and keeps mastery in progress', async () => {
    const service = memoryService();
    const run = await service.start();
    const result = await service.recordAttempt(run.runId, {
      id: 'attempt-current-helped',
      selectedChoiceId: 'return-cart',
      supportRequest: 'help'
    });
    const stored = result.state.attempts.at(-1)!;

    expect(stored.supportLevel).toBe('verbal_prompt');
    expect(stored.criterionMet).toBe(true);
    expect(result.mastery.status).toBe('in_progress');
  });

  it('accepts only one attempt in the current synthetic session', async () => {
    const service = memoryService();
    const run = await service.start();
    await service.recordAttempt(run.runId, {
      id: 'attempt-current-first',
      selectedChoiceId: 'return-cart',
      supportRequest: null
    });

    await expect(service.recordAttempt(run.runId, {
      id: 'attempt-current-second',
      selectedChoiceId: 'return-cart',
      supportRequest: null
    })).rejects.toThrow('Current synthetic session already has an attempt.');
  });

  it('requires an educator decision before returning mastered', async () => {
    const service = memoryService();
    const run = await service.start();
    const ready = await service.recordAttempt(run.runId, {
      id: 'attempt-current-qualifying',
      selectedChoiceId: 'return-cart',
      supportRequest: null
    });
    const confirmed = await service.recordTeacherDecision(run.runId, {
      id: 'decision-confirm-current',
      decision: 'confirm_mastery'
    });
    expect(confirmed.mastery.status).toBe('mastered');
    expect(confirmed.state.teacherDecisions.at(-1)).toMatchObject({
      id: 'decision-confirm-current',
      goalId: run.state.goals[0].id,
      educatorProfileId: run.state.profiles.find((profile) => profile.role === 'educator')!.id,
      decidedAt: '2026-07-19T09:00:00.000Z',
      evidenceAttemptIds: ready.mastery.evidenceAttemptIds!
    });
  });

  it('rejects teacher confirmation before deterministic evidence is ready', async () => {
    const service = memoryService();
    const run = await service.start();

    await expect(service.recordTeacherDecision(run.runId, {
      id: 'decision-too-early',
      decision: 'confirm_mastery'
    })).rejects.toThrow('Current evidence is not ready for teacher confirmation.');
  });

  it('resets only the requested synthetic run', async () => {
    const service = memoryService();
    const first = await service.start();
    const second = await service.start();
    await service.recordAttempt(first.runId, {
      id: 'attempt-first-only',
      selectedChoiceId: 'return-cart',
      supportRequest: null
    });
    const reset = await service.reset(first.runId);
    const untouched = await service.get(second.runId);
    expect(reset.state.attempts).toHaveLength(2);
    expect(untouched.state.attempts).toHaveLength(2);
    expect(reset.runId).not.toBe(untouched.runId);
  });
});
