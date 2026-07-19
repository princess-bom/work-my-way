import { z } from 'zod';
import { evaluateMastery, SUPPORT_LEVELS, type MasteryEvaluation } from '../domain/mastery';

export const DEMO_STORE_VERSION = 1 as const;
export const DEMO_STORE_KEY = 'work-my-way.synthetic-demo';

const ProfileSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['learner', 'educator']),
  displayName: z.string().min(1),
  synthetic: z.literal(true)
});

const GoalSchema = z.object({
  id: z.string().min(1),
  learnerProfileId: z.string().min(1),
  source: z.literal('synthetic_iep_linked_goal'),
  skillLabel: z.string().min(1),
  observableCriterion: z.string().min(1),
  requiredConsecutiveAttempts: z.literal(2),
  maximumSupport: z.literal('visual_choice')
});

const SessionSchema = z.object({
  id: z.string().min(1),
  learnerProfileId: z.string().min(1),
  startedAt: z.string().datetime(),
  activityLabel: z.string().min(1)
});

export const AttemptSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  sessionId: z.string().min(1),
  occurredAt: z.string().datetime(),
  criterionMet: z.boolean(),
  supportLevel: z.enum(SUPPORT_LEVELS),
  selectedChoiceId: z.enum(['return-cart', 'shelf-now', 'front-desk']).optional(),
  observation: z.enum(['completed_observable_step', 'step_not_yet_completed'])
});

export const TeacherDecisionSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  educatorProfileId: z.string().min(1),
  decidedAt: z.string().datetime(),
  decision: z.enum(['confirm_mastery', 'continue_instruction']),
  evidenceAttemptIds: z.tuple([z.string().min(1), z.string().min(1)])
});

export const DemoStateSchema = z.object({
  version: z.literal(DEMO_STORE_VERSION),
  synthetic: z.literal(true),
  profiles: z.array(ProfileSchema).min(2),
  goals: z.array(GoalSchema).length(1),
  sessions: z.array(SessionSchema).length(3),
  attempts: z.array(AttemptSchema),
  teacherDecisions: z.array(TeacherDecisionSchema)
});

export type DemoState = z.infer<typeof DemoStateSchema>;
export type DemoAttempt = z.infer<typeof AttemptSchema>;
export type DemoTeacherDecision = z.infer<typeof TeacherDecisionSchema>;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const INITIAL_DEMO_STATE: DemoState = {
  version: DEMO_STORE_VERSION,
  synthetic: true,
  profiles: [
    { id: 'profile-learner-alex', role: 'learner', displayName: 'Alex M. (synthetic)', synthetic: true },
    { id: 'profile-educator-rivera', role: 'educator', displayName: 'Ms. Rivera (synthetic)', synthetic: true }
  ],
  goals: [{
    id: 'goal-two-step-routine',
    learnerProfileId: 'profile-learner-alex',
    source: 'synthetic_iep_linked_goal',
    skillLabel: 'Follow a two-step workplace routine',
    observableCriterion: 'Completes both observable steps with no more than visual choices',
    requiredConsecutiveAttempts: 2,
    maximumSupport: 'visual_choice'
  }],
  sessions: [
    { id: 'session-library-1', learnerProfileId: 'profile-learner-alex', startedAt: '2026-07-15T09:00:00.000Z', activityLabel: 'Library return cart' },
    { id: 'session-library-2', learnerProfileId: 'profile-learner-alex', startedAt: '2026-07-16T09:00:00.000Z', activityLabel: 'Library shelf labels' },
    { id: 'session-library-3', learnerProfileId: 'profile-learner-alex', startedAt: '2026-07-17T09:00:00.000Z', activityLabel: 'Library return sorting' }
  ],
  attempts: [
    { id: 'attempt-1', goalId: 'goal-two-step-routine', sessionId: 'session-library-1', occurredAt: '2026-07-15T09:10:00.000Z', criterionMet: false, supportLevel: 'verbal_prompt', selectedChoiceId: 'shelf-now', observation: 'step_not_yet_completed' },
    { id: 'attempt-2', goalId: 'goal-two-step-routine', sessionId: 'session-library-2', occurredAt: '2026-07-16T09:10:00.000Z', criterionMet: true, supportLevel: 'visual_choice', selectedChoiceId: 'return-cart', observation: 'completed_observable_step' }
  ],
  teacherDecisions: [{
    id: 'decision-continue-1',
    goalId: 'goal-two-step-routine',
    educatorProfileId: 'profile-educator-rivera',
    decidedAt: '2026-07-16T09:20:00.000Z',
    decision: 'continue_instruction',
    evidenceAttemptIds: ['attempt-1', 'attempt-2']
  }]
};

export function createInitialDemoState(): DemoState {
  return structuredClone(INITIAL_DEMO_STATE);
}

function browserStorage(): StorageLike | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export type DemoStore = {
  getSnapshot(): DemoState;
  getMastery(goalId?: string): MasteryEvaluation;
  recordAttempt(attempt: DemoAttempt): DemoState;
  recordTeacherDecision(decision: DemoTeacherDecision): DemoState;
  reset(): DemoState;
};

export function createDemoStore(storage: StorageLike | undefined = browserStorage()): DemoStore {
  let memoryState = createInitialDemoState();
  let activeStorage = storage;

  function persist(state: DemoState): DemoState {
    memoryState = DemoStateSchema.parse(state);
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
    if (!serialized) {
      return activeStorage ? persist(createInitialDemoState()) : structuredClone(memoryState);
    }

    try {
      memoryState = DemoStateSchema.parse(JSON.parse(serialized));
      return structuredClone(memoryState);
    } catch {
      return reset();
    }
  }

  return {
    getSnapshot,
    getMastery(goalId) {
      const state = getSnapshot();
      const selectedGoalId = goalId ?? state.goals[0].id;
      return evaluateMastery(selectedGoalId, state.attempts, state.teacherDecisions);
    },
    recordAttempt(attempt) {
      const parsed = AttemptSchema.parse(attempt);
      const state = getSnapshot();
      if (!state.goals.some((goal) => goal.id === parsed.goalId)) {
        throw new Error('Attempt references an unknown goal.');
      }
      if (!state.sessions.some((session) => session.id === parsed.sessionId)) {
        throw new Error('Attempt references an unknown session.');
      }
      if (state.attempts.some((existing) => existing.id === parsed.id)) {
        throw new Error('Attempt id already exists.');
      }
      return persist({ ...state, attempts: [...state.attempts, parsed] });
    },
    recordTeacherDecision(decision) {
      const parsed = TeacherDecisionSchema.parse(decision);
      const state = getSnapshot();
      const attemptIds = new Set(state.attempts.map((attempt) => attempt.id));
      if (!state.goals.some((goal) => goal.id === parsed.goalId)) {
        throw new Error('Teacher decision references an unknown goal.');
      }
      if (!state.profiles.some((profile) =>
        profile.id === parsed.educatorProfileId && profile.role === 'educator'
      )) {
        throw new Error('Teacher decision references an unknown educator profile.');
      }
      if (!parsed.evidenceAttemptIds.every((id) => attemptIds.has(id))) {
        throw new Error('Teacher decision references unknown attempt evidence.');
      }
      if (state.teacherDecisions.some((existing) => existing.id === parsed.id)) {
        throw new Error('Teacher decision id already exists.');
      }
      return persist({ ...state, teacherDecisions: [...state.teacherDecisions, parsed] });
    },
    reset
  };
}
