import { describe, expect, it } from 'vitest';
import { createDemoStore, DEMO_STORE_KEY, DEMO_STORE_VERSION, type StorageLike } from './demo-store';

function memoryStorage(initial?: string): StorageLike {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(DEMO_STORE_KEY, initial);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); }
  };
}

describe('synthetic demo store', () => {
  it('seeds a versioned device-local state with three sessions', () => {
    const state = createDemoStore(memoryStorage()).getSnapshot();
    expect(state.version).toBe(DEMO_STORE_VERSION);
    expect(state.synthetic).toBe(true);
    expect(state.goals).toHaveLength(1);
    expect(state.sessions).toHaveLength(3);
    expect(state.teacherDecisions).toHaveLength(1);
  });

  it('recovers deterministically from corrupt or unsupported data', () => {
    const corrupt = createDemoStore(memoryStorage('{not-json')).getSnapshot();
    const oldVersion = createDemoStore(memoryStorage(JSON.stringify({ version: 0 }))).getSnapshot();
    expect(corrupt).toEqual(oldVersion);
    expect(corrupt.version).toBe(DEMO_STORE_VERSION);
  });

  it('continues in memory when device storage is unavailable', () => {
    const unavailable: StorageLike = {
      getItem: () => { throw new Error('storage unavailable'); },
      setItem: () => { throw new Error('storage unavailable'); },
      removeItem: () => { throw new Error('storage unavailable'); }
    };
    const store = createDemoStore(unavailable);
    const before = store.getSnapshot();
    store.recordAttempt({
      id: 'attempt-memory-only',
      goalId: before.goals[0].id,
      sessionId: before.sessions[0].id,
      occurredAt: '2026-07-18T09:00:00.000Z',
      criterionMet: false,
      supportLevel: 'visual_choice',
      observation: 'step_not_yet_completed'
    });
    expect(store.getSnapshot().attempts.at(-1)?.id).toBe('attempt-memory-only');
  });

  it('resets recorded decisions to the synthetic seed', () => {
    const store = createDemoStore(memoryStorage());
    const state = store.getSnapshot();
    store.recordTeacherDecision({
      id: 'decision-1',
      goalId: state.goals[0].id,
      educatorProfileId: state.profiles[1].id,
      decidedAt: '2026-07-18T09:00:00.000Z',
      decision: 'confirm_mastery',
      evidenceAttemptIds: ['attempt-2', 'attempt-3']
    });
    expect(store.getMastery().status).toBe('mastered');
    expect(store.reset().teacherDecisions).toHaveLength(1);
    expect(store.getMastery().status).toBe('ready_for_teacher_review');
  });
});
