export type ViewId = 'landing' | 'launch' | 'intro' | 'day' | 'summary' | 'saved' | 'records' | 'teacher';

export type JobId = 'barista-aide' | 'library-aide' | 'baker-aide';

export type SupportActionId = 'replay' | 'visual' | 'help' | 'pause';

export type ExplorationStageId = 'greeting' | 'broaden' | 'deepen' | 'connect' | 'reflect' | 'complete';

export type StudentInputMode = 'speech' | 'text' | 'choice' | 'picture' | 'aac' | 'help' | 'pause';

export type DetectedSignal = '직업 이해' | '흥미' | '모름/불확실' | '도움 필요' | '쉬기/전환';

export type SupportLevel = '기본' | '시각+선택 중심' | 'AAC 지원' | '교사 확인 대기';

export type TeacherDecision =
  | 'accepted'
  | 'edited'
  | 'dismissed'
  | '이해 확인'
  | '그림 자료로 다시 보기'
  | 'AAC로 표현'
  | '쉬기 후 재개'
  | '다음 수업에서 더 보기';

export type TeacherDecisionPersistence = 'local' | 'mastery-review-api' | 'ai-assistance-decision-api' | 'failed';

export type MasteryReviewTarget = {
  studentId: string;
  criteriaSetId: string;
  criterionId?: string;
  learningUnitId?: string;
  reviewSource?: string;
};

export type TeacherEvidenceTarget = {
  sessionId?: string;
  studentId?: string;
  masteryReviewTarget?: MasteryReviewTarget;
  aiSuggestionId?: string;
};

export type ApiStudentSessionContext = {
  mode: 'api';
  classId: string;
  studentId: string;
  studentToken: string;
  sessionId?: string;
  startedAt: string;
};

export type DemoStudentSessionContext = {
  mode: 'demo';
  startedAt: string;
};

export type StudentSessionContext = ApiStudentSessionContext | DemoStudentSessionContext;

export type AacOptionType = 'object' | 'action' | 'support';

export type AacOption = {
  id: string;
  label: string;
  value: string;
  type: AacOptionType;
  supportAction?: SupportActionId;
};

export type JobScene = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  narration?: string;
  observationPrompt?: string;
  visualTargets?: string[];
  aacOptions?: AacOption[];
  conversationGoal?: string;
};

export type JobProfile = {
  id: JobId;
  title: string;
  shortDescription: string;
  introduction: string;
  accent: 'mint' | 'blue' | 'amber';
  iconLabel: string;
  scenes: JobScene[];
  choices: Array<{
    id: string;
    label: string;
    description: string;
  }>;
};

export type TeacherLog = {
  id: string;
  createdAt: string;
  sessionId?: string;
  studentId?: string;
  studentName: string;
  jobId?: JobId;
  jobTitle: string;
  sceneId?: string;
  stageLabel: string;
  signal: DetectedSignal;
  supportLevel: SupportLevel;
  summary: string;
  responseMode?: 'aac' | 'touch' | 'teacher_support' | 'visual' | 'pause' | 'none';
  studentExpression?: string;
  supportUsed?: string[];
  sceneTurnReached?: 'observe' | 'meaning' | 'practice_support';
  evidenceCandidates?: Array<{
    criterionKey: string;
    title: string;
    candidateLevel: 'not_observed' | 'emerging' | 'with_support' | 'independent';
    candidateStatus: 'needs_review' | 'support_needed' | 'observed' | 'accepted';
    summary: string;
    supportSummary: string;
    teacherReviewQuestion: string;
  }>;
  nextInstructionGuide?: Array<{
    id: string;
    action: string;
    reason: string;
  }>;
  teacherDecisionRequired?: string[];
  masteryReviewTarget?: MasteryReviewTarget;
  aiSuggestionId?: string;
  decisionHistory?: Array<{
    decision: TeacherDecision;
    note: string;
    createdAt: string;
    persistedVia: TeacherDecisionPersistence;
  }>;
  status: '확인 대기' | '기록 완료' | '참고 기록' | '저장 오류';
};

export type ExplorationRecord = {
  id: string;
  createdAt: string;
  studentName: string;
  jobId: JobId;
  jobTitle: string;
  memorableScene: string;
  studentThought: string;
  edenNote: string;
  logs: TeacherLog[];
};

export type AppState = {
  view: ViewId;
  selectedJobId: JobId;
  currentSceneIndex: number;
  selectedSceneId: string;
  selectedThought: string;
  selectedAacOptionId: string | null;
  coachReply: string | null;
  sceneTurnCount: number;
  replaying: boolean;
  visualSupportOpen: boolean;
  resting: boolean;
  studentSession?: StudentSessionContext;
  teacherEvidenceTarget?: TeacherEvidenceTarget;
  teacherDrawerLogId: string | null;
  teacherLogs: TeacherLog[];
  records: ExplorationRecord[];
};

export type CoachGateway = {
  createSupportLog(action: SupportActionId, state: AppState, job: JobProfile): TeacherLog | null;
  createAacLog(option: AacOption, state: AppState, job: JobProfile): TeacherLog | null;
};

export type SessionRepository = {
  load(): Partial<AppState> | null;
  save(state: AppState): void;
  clear(): void;
};
