export type ViewId = 'landing' | 'path' | 'intro' | 'day' | 'summary' | 'saved' | 'records' | 'teacher';

export type JobId = 'barista-aide' | 'library-aide' | 'baker-aide';

export type SupportActionId = 'replay' | 'visual' | 'help' | 'pause';

export type ExplorationStageId = 'greeting' | 'broaden' | 'deepen' | 'connect' | 'reflect' | 'complete';

export type StudentInputMode = 'speech' | 'text' | 'choice' | 'picture' | 'aac' | 'help' | 'pause';

export type DetectedSignal = '직업 이해' | '흥미' | '모름/불확실' | '도움 필요' | '쉬기/전환';

export type SupportLevel = '기본' | '시각+선택 중심' | 'AAC 지원' | '교사 확인 대기';

export type TeacherDecision = '이해 확인' | '그림 자료로 다시 보기' | 'AAC로 표현' | '쉬기 후 재개' | '다음 수업에서 더 보기';

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
  studentName: string;
  jobTitle: string;
  stageLabel: string;
  signal: DetectedSignal;
  supportLevel: SupportLevel;
  summary: string;
  status: '확인 대기' | '기록 완료' | '참고 기록';
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
