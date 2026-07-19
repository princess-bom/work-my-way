import { evaluateMastery, type MasteryEvaluation } from '../domain/mastery';
import {
  AttemptSchema,
  createInitialDemoState,
  DEMO_STORE_VERSION,
  DemoStateSchema,
  parseDemoState,
  parseTeacherDecision,
  TeacherDecisionSchema,
  type DemoAttempt,
  type DemoState,
  type DemoTeacherDecision
} from '../../shared/demo-state';

export {
  AttemptSchema,
  createInitialDemoState,
  DEMO_STORE_VERSION,
  DemoStateSchema,
  parseDemoState,
  parseTeacherDecision,
  TeacherDecisionSchema
} from '../../shared/demo-state';
export type { DemoAttempt, DemoState, DemoTeacherDecision } from '../../shared/demo-state';

export const DEMO_STORE_KEY = 'work-my-way.synthetic-demo';
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): StorageLike | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export type DemoStore = {
  getSnapshot(): DemoState;
  getMastery(goalId?: string): MasteryEvaluation;
  recordAttempt(attempt: DemoAttempt): DemoState;
  recordTeacherDecision(decision: DemoTeacherDecision): DemoState;
  replaceSnapshot(state: DemoState): DemoState;
  reset(): DemoState;
};

export function createDemoStore(storage: StorageLike | undefined = browserStorage()): DemoStore {
  let memoryState = createInitialDemoState();
  let activeStorage = storage;

  function persist(state: DemoState): DemoState {
    memoryState = parseDemoState(state);
    try {
      activeStorage?.setItem(DEMO_STORE_KEY, JSON.stringify(memoryState));
    } catch {
      activeStorage = undefined;
    }
    return structuredClone(memoryState);
  }

  function reset(): DemoState {
    try {
      activeStorage?.removeItem(DEMO_STORE_KEY);
    } catch {
      activeStorage = undefined;
    }
    return persist(createInitialDemoState());
  }

  function getSnapshot(): DemoState {
    let serialized: string | null | undefined;
    try {
      serialized = activeStorage?.getItem(DEMO_STORE_KEY);
    } catch {
      activeStorage = undefined;
    }
    if (!serialized) return activeStorage ? persist(createInitialDemoState()) : structuredClone(memoryState);

    try {
      memoryState = parseDemoState(JSON.parse(serialized));
      return structuredClone(memoryState);
    } catch {
      return reset();
    }
  }

  return {
    getSnapshot,
    getMastery(goalId) {
      const state = getSnapshot();
      return evaluateMastery(goalId ?? state.goals[0].id, state.attempts, state.teacherDecisions);
    },
    recordAttempt(attempt) {
      const parsed = AttemptSchema.parse(attempt);
      const state = getSnapshot();
      if (!state.goals.some((goal) => goal.id === parsed.goalId)) throw new Error('Attempt references an unknown goal.');
      if (!state.sessions.some((session) => session.id === parsed.sessionId)) throw new Error('Attempt references an unknown session.');
      if (state.attempts.some((existing) => existing.id === parsed.id)) throw new Error('Attempt id already exists.');
      return persist({ ...state, attempts: [...state.attempts, parsed] });
    },
    recordTeacherDecision(decision) {
      const parsed = parseTeacherDecision(decision);
      const state = getSnapshot();
      const attemptIds = new Set(state.attempts.map((attempt) => attempt.id));
      if (!state.goals.some((goal) => goal.id === parsed.goalId)) throw new Error('Teacher decision references an unknown goal.');
      if (!state.profiles.some((profile) => profile.id === parsed.educatorProfileId && profile.role === 'educator')) throw new Error('Teacher decision references an unknown educator profile.');
      if (!parsed.evidenceAttemptIds.every((id) => attemptIds.has(id))) throw new Error('Teacher decision references unknown attempt evidence.');
      if (state.teacherDecisions.some((existing) => existing.id === parsed.id)) throw new Error('Teacher decision id already exists.');
      return persist({ ...state, teacherDecisions: [...state.teacherDecisions, parsed] });
    },
    replaceSnapshot: persist,
    reset
  };
}
