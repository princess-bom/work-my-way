import type { AacOption, JobId, JobScene } from './domain';

export type TurnPurpose = 'observe' | 'meaning' | 'practice_or_support';
export type PracticeKind = 'observe' | 'choose' | 'say_phrase' | 'sequence' | 'teacher_supported';
export type EvidenceLevelCandidate = 'not_observed' | 'emerging' | 'with_support' | 'independent';
export type EvidenceStatusCandidate = 'observed' | 'support_needed' | 'needs_review' | 'accepted';
export type SupportRecommendationKind = 'none' | 'visual' | 'choice_reduction' | 'pause' | 'teacher_prompt';
export type ValidationErrorCode =
  | 'invalid_json' | 'invalid_object' | 'missing_required_field' | 'invalid_field'
  | 'banned_student_copy' | 'turn_index_out_of_range' | 'voice_script_too_long'
  | 'too_many_student_questions' | 'teacher_confirmation_required'
  | 'banned_open_chat_prompt' | 'banned_teacher_judgment';
export type ValidationError = { readonly code: ValidationErrorCode; readonly path: string; readonly message: string };
export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T; readonly errors: readonly [] }
  | { readonly ok: false; readonly value?: undefined; readonly errors: readonly ValidationError[] };

type ContractAacOption = Readonly<AacOption>;
type PracticeStep = { readonly kind: PracticeKind; readonly studentAction: string; readonly supportIfNeeded: string };
type ExpectedEvidence = {
  readonly criterionKey: string; readonly evidenceLevelCandidate: EvidenceLevelCandidate;
  readonly evidenceStatusCandidate: EvidenceStatusCandidate; readonly evidenceJson: Readonly<Record<string, unknown>>;
};
type SupportRecommendation = { readonly needed: boolean; readonly kind: SupportRecommendationKind; readonly teacherNote: string };
type TeacherCapture = { readonly studentSignal: string; readonly nextInstructionHint: string; readonly requiresTeacherConfirmation: true };
type NextTurnPolicy = { readonly advance: boolean; readonly reason: string; readonly fallbackIfNoResponse: string };
type SceneEvidence = {
  readonly sceneId: string; readonly observedSignal: string; readonly responseMode: string; readonly supportUsed: string;
  readonly masteryEvidenceCandidate: EvidenceLevelCandidate; readonly teacherReviewNeeded: true;
};
type InstructionGuide = { readonly priority: number; readonly action: string; readonly reason: string };

export type StudentSceneTurnOutput = {
  readonly version: 'ai-mastery-scene-turn/v1'; readonly jobId: JobId; readonly sceneId: string;
  readonly turnIndex: 1 | 2 | 3; readonly turnPurpose: TurnPurpose; readonly voiceScript: string;
  readonly displayText: string; readonly studentQuestion: string; readonly aacOptions: readonly ContractAacOption[];
  readonly deliveredInfo: readonly string[]; readonly practiceStep: PracticeStep;
  readonly expectedEvidence: readonly ExpectedEvidence[]; readonly supportRecommendation: SupportRecommendation;
  readonly teacherCapture: TeacherCapture; readonly nextTurnPolicy: NextTurnPolicy; readonly safetyFlags: readonly string[];
};

export type TeacherSummaryOutput = {
  readonly version: 'ai-mastery-teacher-summary/v1'; readonly studentId: string; readonly sessionId: string;
  readonly jobId: JobId; readonly summaryForTeacher: string; readonly sceneEvidence: readonly SceneEvidence[];
  readonly nextInstructionGuide: readonly InstructionGuide[]; readonly teacherDecisionRequired: readonly string[];
  readonly mustNotShowToStudent: readonly string[];
};

export type MasteryEvidenceSuggestionOutput = {
  readonly version: 'ai-mastery-evidence-suggestion/v1'; readonly suggestionType: 'mastery_evidence';
  readonly criterionKey: string; readonly candidateLevel: EvidenceLevelCandidate;
  readonly candidateStatus: Exclude<EvidenceStatusCandidate, 'accepted'>; readonly evidenceSummary: string;
  readonly supportSummary: string; readonly teacherReviewQuestion: string; readonly recommendedNextInstruction: string;
  readonly teacherFinalDecisionRequired: true;
};

export type InterviewPracticeDraftOutput = {
  readonly version: 'ai-interview-practice-draft/v1'; readonly jobId: JobId;
  readonly readinessDecision: 'teacher_required'; readonly practicePrompt: string;
  readonly allowedStudentResponses: readonly string[]; readonly teacherSetup: string;
  readonly notAPlacementDecision: true;
};

const sceneTurnVersion = 'ai-mastery-scene-turn/v1';
const teacherSummaryVersion = 'ai-mastery-teacher-summary/v1';
const masterySuggestionVersion = 'ai-mastery-evidence-suggestion/v1';
const interviewDraftVersion = 'ai-interview-practice-draft/v1';
const bannedStudentCopyPattern = /점수|등급|적합률|정답률|정답|틀렸|잘했|실패|오답/;
const openChatStudentQuestionPatterns: readonly RegExp[] = [
  /(?:무엇이든|뭐든|아무거나).{0,16}(?:자유롭게\s*)?(?:이야기|말)/i,
  /자유롭게.{0,16}(?:이야기|말)|자유\s*대화/i,
  /free\s*chat|open[-\s]?ended/i
];
const teacherJudgmentPatterns: readonly RegExp[] = [
  /적합\s*률|직업\s*적합|순위|랭킹|\brank(?:ing)?\b/i,
  /job[-\s]*fit|suitability\s*(?:score|rate|ranking)|matching\s*(?:rate|score|percentage)/i,
  /AI\s*final\s*judg(?:e)?ment|AI.{0,12}최종\s*(?:판단|판정)|최종\s*(?:판단|판정)/i
];
const teacherNegativeJudgmentPatterns: readonly RegExp[] = [
  /(?:학생|수행|능력|역량|직업|적합|준비도|숙달|기술|이해|활동).{0,20}부족합니다/,
  /부족합니다.{0,20}(?:학생|수행|능력|역량|직업|적합|준비도|숙달|기술|이해|활동)/
];
const jobIds: readonly JobId[] = ['barista-aide', 'library-aide', 'baker-aide'];
const turnPurposes: readonly TurnPurpose[] = ['observe', 'meaning', 'practice_or_support'];
const practiceKinds: readonly PracticeKind[] = ['observe', 'choose', 'say_phrase', 'sequence', 'teacher_supported'];
const evidenceLevels: readonly EvidenceLevelCandidate[] = ['not_observed', 'emerging', 'with_support', 'independent'];
const evidenceStatuses: readonly EvidenceStatusCandidate[] = ['observed', 'support_needed', 'needs_review', 'accepted'];
const openEvidenceStatuses: readonly Exclude<EvidenceStatusCandidate, 'accepted'>[] = ['observed', 'support_needed', 'needs_review'];
const supportKinds: readonly SupportRecommendationKind[] = ['none', 'visual', 'choice_reduction', 'pause', 'teacher_prompt'];
const aacTypes: readonly AacOption['type'][] = ['object', 'action', 'support'];
const supportActions: readonly NonNullable<AacOption['supportAction']>[] = ['replay', 'visual', 'help', 'pause'];

export function validateStudentSceneTurnOutput(input: unknown): ValidationResult<StudentSceneTurnOutput> {
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;

  const value = parsed.value;
  const ctx = new ValidationContext();
  ctx.literal(value, 'version', sceneTurnVersion);
  const output: StudentSceneTurnOutput = {
    version: sceneTurnVersion,
    jobId: ctx.choice(value.jobId, 'jobId', jobIds, 'barista-aide'),
    sceneId: ctx.string(value, 'sceneId'),
    turnIndex: turn(value.turnIndex, 'turnIndex', ctx),
    turnPurpose: ctx.choice(value.turnPurpose, 'turnPurpose', turnPurposes, 'observe'),
    voiceScript: ctx.string(value, 'voiceScript'),
    displayText: ctx.string(value, 'displayText'),
    studentQuestion: ctx.string(value, 'studentQuestion'),
    aacOptions: aacList(value.aacOptions, 'aacOptions', ctx),
    deliveredInfo: ctx.stringList(value.deliveredInfo, 'deliveredInfo'),
    practiceStep: practice(value.practiceStep, 'practiceStep', ctx),
    expectedEvidence: evidenceList(value.expectedEvidence, 'expectedEvidence', ctx),
    supportRecommendation: support(value.supportRecommendation, 'supportRecommendation', ctx),
    teacherCapture: capture(value.teacherCapture, 'teacherCapture', ctx),
    nextTurnPolicy: nextPolicy(value.nextTurnPolicy, 'nextTurnPolicy', ctx),
    safetyFlags: ctx.stringList(value.safetyFlags, 'safetyFlags')
  };

  if (output.voiceScript.length > 120) {
    ctx.add('voice_script_too_long', 'voiceScript', 'Normal student scene voiceScript must be 120 characters or less.');
  }
  checkStudentCopy(ctx, 'voiceScript', output.voiceScript);
  checkStudentCopy(ctx, 'displayText', output.displayText);
  checkStudentCopy(ctx, 'studentQuestion', output.studentQuestion);
  checkOpenChatStudentQuestion(ctx, 'studentQuestion', output.studentQuestion);
  output.aacOptions.forEach((option, index) => {
    checkStudentCopy(ctx, `aacOptions.${index}.label`, option.label);
    checkStudentCopy(ctx, `aacOptions.${index}.value`, option.value);
  });
  if (output.studentQuestion && questionCount(output.studentQuestion) > 1) {
    ctx.add('too_many_student_questions', 'studentQuestion', 'Student scene output must ask no more than one question.');
  }
  return ctx.result(output);
}

export function validateTeacherSummaryOutput(input: unknown): ValidationResult<TeacherSummaryOutput> {
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;

  const value = parsed.value;
  const ctx = new ValidationContext();
  ctx.literal(value, 'version', teacherSummaryVersion);
  const output: TeacherSummaryOutput = {
    version: teacherSummaryVersion,
    studentId: ctx.string(value, 'studentId'),
    sessionId: ctx.string(value, 'sessionId'),
    jobId: ctx.choice(value.jobId, 'jobId', jobIds, 'barista-aide'),
    summaryForTeacher: ctx.string(value, 'summaryForTeacher'),
    sceneEvidence: teacherEvidence(value.sceneEvidence, 'sceneEvidence', ctx),
    nextInstructionGuide: instructionList(value.nextInstructionGuide, 'nextInstructionGuide', ctx),
    teacherDecisionRequired: ctx.stringList(value.teacherDecisionRequired, 'teacherDecisionRequired'),
    mustNotShowToStudent: ctx.stringList(value.mustNotShowToStudent, 'mustNotShowToStudent')
  };
  checkTeacherSummaryJudgment(ctx, output);
  return ctx.result(output);
}

export function validateMasteryEvidenceSuggestionOutput(
  input: unknown
): ValidationResult<MasteryEvidenceSuggestionOutput> {
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;

  const value = parsed.value;
  const ctx = new ValidationContext();
  ctx.literal(value, 'version', masterySuggestionVersion);
  ctx.literal(value, 'suggestionType', 'mastery_evidence');
  return ctx.result({
    version: masterySuggestionVersion,
    suggestionType: 'mastery_evidence',
    criterionKey: ctx.string(value, 'criterionKey'),
    candidateLevel: ctx.choice(value.candidateLevel, 'candidateLevel', evidenceLevels, 'emerging'),
    candidateStatus: ctx.choice(value.candidateStatus, 'candidateStatus', openEvidenceStatuses, 'needs_review'),
    evidenceSummary: ctx.string(value, 'evidenceSummary'),
    supportSummary: ctx.string(value, 'supportSummary'),
    teacherReviewQuestion: ctx.string(value, 'teacherReviewQuestion'),
    recommendedNextInstruction: ctx.string(value, 'recommendedNextInstruction'),
    teacherFinalDecisionRequired: ctx.trueValue(value.teacherFinalDecisionRequired, 'teacherFinalDecisionRequired')
  });
}

export function validateInterviewPracticeDraftOutput(input: unknown): ValidationResult<InterviewPracticeDraftOutput> {
  const parsed = parseInput(input);
  if (!parsed.ok) return parsed;

  const value = parsed.value;
  const ctx = new ValidationContext();
  ctx.literal(value, 'version', interviewDraftVersion);
  const output: InterviewPracticeDraftOutput = {
    version: interviewDraftVersion,
    jobId: ctx.choice(value.jobId, 'jobId', jobIds, 'barista-aide'),
    readinessDecision: ctx.teacherRequired(value.readinessDecision, 'readinessDecision'),
    practicePrompt: ctx.string(value, 'practicePrompt'),
    allowedStudentResponses: ctx.stringList(value.allowedStudentResponses, 'allowedStudentResponses'),
    teacherSetup: ctx.string(value, 'teacherSetup'),
    notAPlacementDecision: ctx.trueValue(value.notAPlacementDecision, 'notAPlacementDecision')
  };
  checkStudentCopy(ctx, 'practicePrompt', output.practicePrompt);
  output.allowedStudentResponses.forEach((response, index) => {
    checkStudentCopy(ctx, `allowedStudentResponses.${index}`, response);
  });
  return ctx.result(output);
}

export function createFallbackStudentSceneTurn(input: {
  readonly jobId: JobId; readonly scene: JobScene; readonly turnIndex: number; readonly reason: string;
}): StudentSceneTurnOutput {
  const turnIndex = input.turnIndex === 2 || input.turnIndex === 3 ? input.turnIndex : 1;
  const turnPurpose = turnIndex === 1 ? 'observe' : turnIndex === 2 ? 'meaning' : 'practice_or_support';
  const sceneName = input.scene.label.replace(/^\d+\s*/, '').trim() || input.scene.description;
  const fallbackAacOptions: ContractAacOption[] = [
    { id: 'scene-choice', label: sceneName, value: input.scene.description, type: 'action' }
  ];

  return {
    version: sceneTurnVersion,
    jobId: input.jobId,
    sceneId: input.scene.id,
    turnIndex,
    turnPurpose,
    voiceScript: `${sceneName} 장면을 천천히 살펴보겠습니다. 보이는 것을 버튼으로 하나 골라볼까요?`,
    displayText: `${sceneName} 장면을 살펴봐요.`,
    studentQuestion: '그림에서 보이는 것을 하나 골라볼까요?',
    aacOptions: input.scene.aacOptions ?? fallbackAacOptions,
    deliveredInfo: [input.scene.narration ?? input.scene.description],
    practiceStep: {
      kind: turnPurpose === 'practice_or_support' ? 'teacher_supported' : 'choose',
      studentAction: 'AAC 선택지 중 하나를 고르거나 교사 도움을 요청한다.',
      supportIfNeeded: '선택지를 2개로 줄이고 그림 단서를 다시 보여준다.'
    },
    expectedEvidence: [{
      criterionKey: 'scene_participation',
      evidenceLevelCandidate: 'emerging',
      evidenceStatusCandidate: 'needs_review',
      evidenceJson: { sceneId: input.scene.id, responseMode: 'aac', turnPurpose }
    }],
    supportRecommendation: {
      needed: true,
      kind: 'teacher_prompt',
      teacherNote: '검증 차단 후 안전한 장면 AAC 선택지로 대체되었습니다.'
    },
    teacherCapture: {
      studentSignal: '검증 차단 fallback으로 장면 선택지를 제시함',
      nextInstructionHint: '학생이 고른 AAC 선택지를 보고 다음 수업 지원을 정한다.',
      requiresTeacherConfirmation: true
    },
    nextTurnPolicy: {
      advance: false,
      reason: 'AI 출력 검증 차단 후 교사 확인이 필요하다.',
      fallbackIfNoResponse: '그림 단서와 선택지를 줄여 다시 제시한다.'
    },
    safetyFlags: [`fallback:${input.reason}`]
  };
}

type ArrayItemSpec<T> = {
  readonly missingMessage: string; readonly itemMessage: string;
  readonly parse: (item: Record<string, unknown>, itemPath: string) => T;
};
type ObjectSpec<T> = { readonly missingMessage: string; readonly fallback: T; readonly parse: (item: Record<string, unknown>) => T };

class ValidationContext {
  readonly errors: ValidationError[] = [];

  add(code: ValidationErrorCode, path: string, message: string): void { this.errors.push({ code, path, message }); }

  result<T>(value: T): ValidationResult<T> {
    return this.errors.length > 0 ? { ok: false, errors: this.errors } : { ok: true, value, errors: [] };
  }

  literal<T extends string>(source: Record<string, unknown>, key: string, expected: T): T {
    if (source[key] !== expected) this.add(missingOrInvalid(source[key]), key, `${key} must be ${expected}.`);
    return expected;
  }

  string(source: Record<string, unknown>, key: string, path = key): string {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value;
    this.add(missingOrInvalid(value), path, `${path} must be a non-empty string.`);
    return '';
  }

  number(source: Record<string, unknown>, key: string, path = key): number {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    this.add(missingOrInvalid(value), path, `${path} must be a finite number.`);
    return 0;
  }

  bool(source: Record<string, unknown>, key: string, path = key): boolean {
    const value = source[key];
    if (typeof value === 'boolean') return value;
    this.add(missingOrInvalid(value), path, `${path} must be a boolean.`);
    return false;
  }

  choice<T extends string>(value: unknown, path: string, values: readonly T[], fallback: T): T {
    for (const allowed of values) {
      if (value === allowed) return allowed;
    }
    this.add(missingOrInvalid(value), path, `${path} is not an allowed value.`);
    return fallback;
  }

  trueValue(value: unknown, path: string): true {
    if (value !== true) this.add('teacher_confirmation_required', path, `${path} must remain true.`);
    return true;
  }

  teacherRequired(value: unknown, path: string): 'teacher_required' {
    if (value !== 'teacher_required') this.add('teacher_confirmation_required', path, `${path} must be teacher_required.`);
    return 'teacher_required';
  }

  optionalChoice<T extends string>(value: unknown, path: string, values: readonly T[]): T | undefined {
    if (value === undefined) return undefined;
    for (const allowed of values) {
      if (value === allowed) return allowed;
    }
    this.add('invalid_field', path, 'AAC supportAction is not allowed.');
    return undefined;
  }

  stringList(value: unknown, path: string): string[] {
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
    this.add(missingOrInvalid(value), path, `${path} must be a string array.`);
    return [];
  }

  array<T>(value: unknown, path: string, spec: ArrayItemSpec<T>): T[] {
    if (!Array.isArray(value)) {
      this.add(missingOrInvalid(value), path, spec.missingMessage);
      return [];
    }
    const items: T[] = [];
    value.forEach((item, index) => {
      const itemPath = `${path}.${index}`;
      if (isObject(item)) items.push(spec.parse(item, itemPath));
      else this.add('invalid_field', itemPath, spec.itemMessage);
    });
    return items;
  }

  object<T>(value: unknown, path: string, spec: ObjectSpec<T>): T {
    if (isObject(value)) return spec.parse(value);
    this.add(missingOrInvalid(value), path, spec.missingMessage);
    return spec.fallback;
  }
}

function parseInput(input: unknown): ValidationResult<Record<string, unknown>> {
  if (typeof input !== 'string') {
    if (isObject(input)) return { ok: true, value: input, errors: [] };
    return invalidObject();
  }
  try {
    return parseInput(JSON.parse(input));
  } catch (error) {
    const suffix = error instanceof Error && error.message ? ` ${error.message}` : '';
    return { ok: false, errors: [{ code: 'invalid_json', path: '$', message: `Model output is not valid JSON.${suffix}` }] };
  }
}

function invalidObject(): ValidationResult<Record<string, unknown>> {
  return { ok: false, errors: [{ code: 'invalid_object', path: '$', message: 'Model output must be a JSON object.' }] };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function missingOrInvalid(value: unknown): ValidationErrorCode {
  return value === undefined ? 'missing_required_field' : 'invalid_field';
}

function turn(value: unknown, path: string, ctx: ValidationContext): 1 | 2 | 3 {
  if (value === 1 || value === 2 || value === 3) return value;
  ctx.add(value === undefined ? 'missing_required_field' : 'turn_index_out_of_range', path, `${path} must be 1, 2, or 3.`);
  return 1;
}

function supportAction(value: unknown, path: string, ctx: ValidationContext): AacOption['supportAction'] {
  return ctx.optionalChoice(value, path, supportActions);
}

function aacList(value: unknown, path: string, ctx: ValidationContext): ContractAacOption[] {
  return ctx.array(value, path, {
    missingMessage: `${path} must be an AAC option array.`,
    itemMessage: 'AAC option must be an object.',
    parse: (item, itemPath) => ({
      id: ctx.string(item, 'id', `${itemPath}.id`),
      label: ctx.string(item, 'label', `${itemPath}.label`),
      value: ctx.string(item, 'value', `${itemPath}.value`),
      type: ctx.choice(item.type, `${itemPath}.type`, aacTypes, 'object'),
      supportAction: supportAction(item.supportAction, `${itemPath}.supportAction`, ctx)
    })
  });
}

function practice(value: unknown, path: string, ctx: ValidationContext): PracticeStep {
  return ctx.object(value, path, {
    missingMessage: `${path} must be an object.`,
    fallback: { kind: 'choose', studentAction: '', supportIfNeeded: '' },
    parse: (item) => ({
      kind: ctx.choice(item.kind, `${path}.kind`, practiceKinds, 'choose'),
      studentAction: ctx.string(item, 'studentAction', `${path}.studentAction`),
      supportIfNeeded: ctx.string(item, 'supportIfNeeded', `${path}.supportIfNeeded`)
    })
  });
}

function evidenceList(value: unknown, path: string, ctx: ValidationContext): ExpectedEvidence[] {
  return ctx.array(value, path, {
    missingMessage: `${path} must be an evidence array.`,
    itemMessage: 'Evidence item must be an object.',
    parse: (item, itemPath) => ({
      criterionKey: ctx.string(item, 'criterionKey', `${itemPath}.criterionKey`),
      evidenceLevelCandidate: ctx.choice(item.evidenceLevelCandidate, `${itemPath}.evidenceLevelCandidate`, evidenceLevels, 'emerging'),
      evidenceStatusCandidate: ctx.choice(item.evidenceStatusCandidate, `${itemPath}.evidenceStatusCandidate`, evidenceStatuses, 'needs_review'),
      evidenceJson: evidenceJson(item.evidenceJson, `${itemPath}.evidenceJson`, ctx)
    })
  });
}

function evidenceJson(value: unknown, path: string, ctx: ValidationContext): Readonly<Record<string, unknown>> {
  if (isObject(value)) return value;
  ctx.add('invalid_field', path, 'evidenceJson must be an object.');
  return {};
}

function support(value: unknown, path: string, ctx: ValidationContext): SupportRecommendation {
  return ctx.object(value, path, {
    missingMessage: `${path} must be an object.`,
    fallback: { needed: false, kind: 'none', teacherNote: '' },
    parse: (item) => ({
      needed: ctx.bool(item, 'needed', `${path}.needed`),
      kind: ctx.choice(item.kind, `${path}.kind`, supportKinds, 'none'),
      teacherNote: typeof item.teacherNote === 'string' ? item.teacherNote : ''
    })
  });
}

function capture(value: unknown, path: string, ctx: ValidationContext): TeacherCapture {
  return ctx.object(value, path, {
    missingMessage: `${path} must be an object.`,
    fallback: { studentSignal: '', nextInstructionHint: '', requiresTeacherConfirmation: true },
    parse: (item) => ({
      studentSignal: ctx.string(item, 'studentSignal', `${path}.studentSignal`),
      nextInstructionHint: ctx.string(item, 'nextInstructionHint', `${path}.nextInstructionHint`),
      requiresTeacherConfirmation: ctx.trueValue(item.requiresTeacherConfirmation, `${path}.requiresTeacherConfirmation`)
    })
  });
}

function nextPolicy(value: unknown, path: string, ctx: ValidationContext): NextTurnPolicy {
  return ctx.object(value, path, {
    missingMessage: `${path} must be an object.`,
    fallback: { advance: false, reason: '', fallbackIfNoResponse: '' },
    parse: (item) => ({
      advance: ctx.bool(item, 'advance', `${path}.advance`),
      reason: ctx.string(item, 'reason', `${path}.reason`),
      fallbackIfNoResponse: ctx.string(item, 'fallbackIfNoResponse', `${path}.fallbackIfNoResponse`)
    })
  });
}

function teacherEvidence(value: unknown, path: string, ctx: ValidationContext): SceneEvidence[] {
  return ctx.array(value, path, {
    missingMessage: `${path} must be an array.`,
    itemMessage: 'Scene evidence must be an object.',
    parse: (item, itemPath) => ({
      sceneId: ctx.string(item, 'sceneId', `${itemPath}.sceneId`),
      observedSignal: ctx.string(item, 'observedSignal', `${itemPath}.observedSignal`),
      responseMode: ctx.string(item, 'responseMode', `${itemPath}.responseMode`),
      supportUsed: ctx.string(item, 'supportUsed', `${itemPath}.supportUsed`),
      masteryEvidenceCandidate: ctx.choice(
        item.masteryEvidenceCandidate,
        `${itemPath}.masteryEvidenceCandidate`,
        evidenceLevels,
        'emerging'
      ),
      teacherReviewNeeded: ctx.trueValue(item.teacherReviewNeeded, `${itemPath}.teacherReviewNeeded`)
    })
  });
}

function instructionList(value: unknown, path: string, ctx: ValidationContext): InstructionGuide[] {
  return ctx.array(value, path, {
    missingMessage: `${path} must be an array.`,
    itemMessage: 'Instruction guide must be an object.',
    parse: (item, itemPath) => ({
      priority: ctx.number(item, 'priority', `${itemPath}.priority`),
      action: ctx.string(item, 'action', `${itemPath}.action`),
      reason: ctx.string(item, 'reason', `${itemPath}.reason`)
    })
  });
}

function checkStudentCopy(ctx: ValidationContext, path: string, text: string): void {
  if (bannedStudentCopyPattern.test(text)) {
    ctx.add('banned_student_copy', path, `${path} contains banned student-visible copy.`);
  }
}

function checkOpenChatStudentQuestion(ctx: ValidationContext, path: string, text: string): void {
  if (openChatStudentQuestionPatterns.some((pattern) => pattern.test(normalizeSpaces(text)))) {
    ctx.add('banned_open_chat_prompt', path, `${path} must stay anchored to the current mastery scene task.`);
  }
}

function checkTeacherSummaryJudgment(ctx: ValidationContext, output: TeacherSummaryOutput): void {
  checkTeacherJudgment(ctx, 'summaryForTeacher', output.summaryForTeacher);
  output.sceneEvidence.forEach((item, index) => {
    checkTeacherJudgment(ctx, `sceneEvidence.${index}.observedSignal`, item.observedSignal);
    checkTeacherJudgment(ctx, `sceneEvidence.${index}.responseMode`, item.responseMode);
    checkTeacherJudgment(ctx, `sceneEvidence.${index}.supportUsed`, item.supportUsed);
  });
  output.nextInstructionGuide.forEach((item, index) => {
    checkTeacherJudgment(ctx, `nextInstructionGuide.${index}.action`, item.action);
    checkTeacherJudgment(ctx, `nextInstructionGuide.${index}.reason`, item.reason);
  });
  output.teacherDecisionRequired.forEach((item, index) => {
    checkTeacherJudgment(ctx, `teacherDecisionRequired.${index}`, item);
  });
  output.mustNotShowToStudent.forEach((item, index) => {
    checkTeacherJudgment(ctx, `mustNotShowToStudent.${index}`, item);
  });
}

function checkTeacherJudgment(ctx: ValidationContext, path: string, text: string): void {
  const normalized = normalizeSpaces(text);
  if (
    teacherJudgmentPatterns.some((pattern) => pattern.test(normalized)) ||
    teacherNegativeJudgmentPatterns.some((pattern) => pattern.test(normalized))
  ) {
    ctx.add('banned_teacher_judgment', path, `${path} contains scoring, ranking, or final judgment wording.`);
  }
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function questionCount(text: string): number {
  const marked = text.match(/[?？]/g)?.length ?? 0;
  return marked || (text.match(/(?:나요|까요|습니까|세요)\s*(?:$|[.。])/g)?.length ?? 0);
}
