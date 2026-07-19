import { z } from 'zod';
import { SUPPORT_LEVELS } from './mastery.js';

export const DEMO_STORE_VERSION = 2 as const;

export const ProfileSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['learner', 'educator']),
  displayName: z.string().min(1),
  synthetic: z.literal(true)
});

export const GoalSchema = z.object({
  id: z.string().min(1),
  learnerProfileId: z.string().min(1),
  source: z.literal('synthetic_iep_linked_goal'),
  skillLabel: z.string().min(1),
  observableCriterion: z.string().min(1),
  requiredConsecutiveAttempts: z.literal(2),
  maximumSupport: z.literal('visual_choice')
});

export const SessionSchema = z.object({
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

export type DemoAttempt = z.infer<typeof AttemptSchema>;
type ParsedTeacherDecision = z.infer<typeof TeacherDecisionSchema>;
export type DemoTeacherDecision = Omit<ParsedTeacherDecision, 'evidenceAttemptIds'> & {
  evidenceAttemptIds: [string, string];
};
type ParsedDemoState = z.infer<typeof DemoStateSchema>;
export type DemoState = Omit<ParsedDemoState, 'teacherDecisions'> & {
  teacherDecisions: DemoTeacherDecision[];
};

export function parseDemoState(value: unknown): DemoState {
  return DemoStateSchema.parse(value) as DemoState;
}

export function parseTeacherDecision(value: unknown): DemoTeacherDecision {
  return TeacherDecisionSchema.parse(value) as DemoTeacherDecision;
}

const INITIAL_DEMO_STATE: DemoState = {
  version: DEMO_STORE_VERSION,
  synthetic: true,
  profiles: [
    { id: 'profile-learner-minjun', role: 'learner', displayName: '민준 (가상 학생)', synthetic: true },
    { id: 'profile-educator-demo', role: 'educator', displayName: '데모 교사', synthetic: true }
  ],
  goals: [{
    id: 'goal-library-return-sort',
    learnerProfileId: 'profile-learner-minjun',
    source: 'synthetic_iep_linked_goal',
    skillLabel: '반납된 책의 라벨을 확인하고 알맞은 반납 카트에 놓기',
    observableCriterion: '서로 다른 두 회기에서 그림 선택 도움 이하로 반납 카트를 선택한다.',
    requiredConsecutiveAttempts: 2,
    maximumSupport: 'visual_choice'
  }],
  sessions: [
    { id: 'session-library-1', learnerProfileId: 'profile-learner-minjun', startedAt: '2026-07-15T09:00:00.000Z', activityLabel: '반납대 살펴보기' },
    { id: 'session-library-2', learnerProfileId: 'profile-learner-minjun', startedAt: '2026-07-16T09:00:00.000Z', activityLabel: '책 라벨 비교하기' },
    { id: 'session-library-3', learnerProfileId: 'profile-learner-minjun', startedAt: '2026-07-17T09:00:00.000Z', activityLabel: '반납된 책 정리하기' }
  ],
  attempts: [
    { id: 'attempt-1', goalId: 'goal-library-return-sort', sessionId: 'session-library-1', occurredAt: '2026-07-15T09:10:00.000Z', criterionMet: false, supportLevel: 'verbal_prompt', selectedChoiceId: 'shelf-now', observation: 'step_not_yet_completed' },
    { id: 'attempt-2', goalId: 'goal-library-return-sort', sessionId: 'session-library-2', occurredAt: '2026-07-16T09:10:00.000Z', criterionMet: true, supportLevel: 'visual_choice', selectedChoiceId: 'return-cart', observation: 'completed_observable_step' }
  ],
  teacherDecisions: [{
    id: 'decision-continue-1',
    goalId: 'goal-library-return-sort',
    educatorProfileId: 'profile-educator-demo',
    decidedAt: '2026-07-16T09:20:00.000Z',
    decision: 'continue_instruction',
    evidenceAttemptIds: ['attempt-1', 'attempt-2']
  }]
};

export function createInitialDemoState(): DemoState {
  return structuredClone(INITIAL_DEMO_STATE);
}
