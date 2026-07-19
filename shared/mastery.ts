export const SUPPORT_LEVELS = ['none', 'visual_choice', 'verbal_prompt', 'direct_model'] as const;
export type SupportLevel = (typeof SUPPORT_LEVELS)[number];

export type MasteryStatus = 'in_progress' | 'ready_for_teacher_review' | 'mastered';

export type MasteryAttempt = {
  id: string;
  goalId: string;
  sessionId: string;
  occurredAt: string;
  criterionMet: boolean;
  supportLevel: SupportLevel;
};

export type MasteryDecision = {
  goalId: string;
  decidedAt: string;
  decision: 'confirm_mastery' | 'continue_instruction';
  evidenceAttemptIds: [string, string];
};

export type MasteryEvaluation = {
  status: MasteryStatus;
  evidenceAttemptIds: [string, string] | null;
};

const MAX_INDEPENDENT_SUPPORT: SupportLevel = 'visual_choice';

function supportIsWithinCriterion(level: SupportLevel): boolean {
  return SUPPORT_LEVELS.indexOf(level) <= SUPPORT_LEVELS.indexOf(MAX_INDEPENDENT_SUPPORT);
}

/**
 * Evaluates recorded evidence only. Generative model output is intentionally not
 * accepted by this boundary and therefore cannot decide mastery.
 */
export function evaluateMastery(
  goalId: string,
  attempts: readonly MasteryAttempt[],
  decisions: readonly MasteryDecision[]
): MasteryEvaluation {
  const ordered = attempts
    .filter((attempt) => attempt.goalId === goalId)
    .slice()
    .sort((left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id)
    );

  const candidate = ordered.slice(-2);
  const evidence: [MasteryAttempt, MasteryAttempt] | null =
    candidate.length === 2 &&
    candidate[0].criterionMet &&
    candidate[1].criterionMet &&
    supportIsWithinCriterion(candidate[0].supportLevel) &&
    supportIsWithinCriterion(candidate[1].supportLevel) &&
    candidate[0].sessionId !== candidate[1].sessionId
      ? [candidate[0], candidate[1]]
      : null;

  if (!evidence) {
    return { status: 'in_progress', evidenceAttemptIds: null };
  }

  const evidenceAttemptIds: [string, string] = [evidence[0].id, evidence[1].id];
  const latestDecision = decisions
    .filter((decision) => decision.goalId === goalId)
    .slice()
    .sort((left, right) => right.decidedAt.localeCompare(left.decidedAt))[0];
  const confirmsThisEvidence =
    latestDecision?.decision === 'confirm_mastery' &&
    latestDecision.decidedAt >= evidence[1].occurredAt &&
    evidenceAttemptIds.every((id) => latestDecision.evidenceAttemptIds.includes(id));

  return {
    status: confirmsThisEvidence ? 'mastered' : 'ready_for_teacher_review',
    evidenceAttemptIds
  };
}
