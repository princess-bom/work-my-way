import type {
  AacOption,
  ApiStudentSessionContext,
  AppState,
  CoachGateway,
  ExplorationRecord,
  JobProfile,
  SessionRepository,
  SupportActionId,
  TeacherDecision,
  TeacherDecisionPersistence,
  TeacherLog
} from './domain';

const storageKey = 'kkumideun-findjob-frontend-session-v1';

export type TeacherRole = 'admin' | 'teacher' | 'support_staff';

export type TeacherSession = {
  id: string;
  schoolId: string;
  role: TeacherRole;
  displayName: string;
};

export type TeacherClassSummary = {
  id: string;
  name: string;
  gradeLabel?: string | null;
  schoolYear?: number | null;
  active?: boolean;
};

export type TeacherRosterStudent = {
  id: string;
  classId: string;
  studentCode: string;
  displayName: string;
  classNumber?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TeacherRosterStudentInput = {
  studentCode: string;
  displayName: string;
  classNumber?: string | null;
  active?: boolean;
};

export type TeacherLaunchCodeResult = {
  launchCode: string;
  expiresAt: string;
  student: {
    id: string;
    classId: string;
  };
};

export type StudentLaunchResolveInput = {
  classId: string;
  studentCode: string;
  launchCode: string;
};

export type StudentLaunchResolveResult = {
  student: {
    id: string;
    classId: string;
  };
  studentToken: string;
};

export type ExplorationSessionEventInput = {
  eventType: string;
  stage?: string;
  jobSceneId?: string;
  inputMode?: string;
  payload?: Record<string, unknown>;
};

export type ExplorationSessionResponseInput = {
  jobSceneId?: string;
  inputMode: string;
  responseModality?: string;
  selectedValue?: string;
  interpretedResponse?: string;
  supportUsed?: string;
};

export type ExplorationSessionRecordInput = {
  memorableSceneId?: string;
  studentThought: string;
  edenNote: string;
  teacherNote?: string;
};

export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

export const localSessionRepository: SessionRepository = {
  load() {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as Partial<AppState>;
    } catch (error) {
      // Invalid persisted JSON is recoverable; other storage/runtime failures must surface.
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  },
  save(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  },
  clear() {
    localStorage.removeItem(storageKey);
  }
};

function nowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const body = payload as { error?: string; code?: string; message?: string };
    throw new ApiClientError(response.status, body.code ?? body.error ?? `http_${response.status}`, body.message);
  }
  return payload as T;
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers
      }
    });
  } catch (error) {
    throw new ApiClientError(0, 'network_error', error instanceof Error ? error.message : 'network_error');
  }

  return readJsonResponse<T>(response);
}

export function canManageRoster(role?: TeacherRole | null) {
  return role === 'admin' || role === 'teacher';
}

export function getRosterErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 409 || error.code === 'duplicate_student_code') {
      return '이미 사용하는 학생 코드입니다. 다른 코드로 다시 저장해 주세요.';
    }
    if (error.status === 403) {
      return '이 반의 학생 정보를 변경할 권한이 없습니다.';
    }
    if (error.status === 404) {
      return '반이 비활성화되었거나 학생 정보를 찾을 수 없습니다.';
    }
    if (error.status === 401) {
      return '교사 로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.';
    }
    if (error.status === 0 || error.code === 'network_error') {
      return '네트워크 오류로 저장하지 못했습니다. 입력한 내용은 유지되며 다시 시도할 수 있습니다.';
    }
  }

  return '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
}

export function isApiStudentSession(session: AppState['studentSession']): session is ApiStudentSessionContext {
  return session?.mode === 'api';
}

function studentContextHeaders(context: ApiStudentSessionContext): Record<string, string> {
  return {
    authorization: `Student ${context.studentToken}`
  };
}

export function getStudentLaunchErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 0 || error.code === 'network_error') {
      return '서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
    }
    if (error.status === 429 || error.code === 'student_resolve_locked') {
      return '시도가 잠시 제한되었습니다. 15분 뒤 다시 시도해 주세요.';
    }
    if (error.code === 'launch_code_expired') {
      return '입장 코드 시간이 지났습니다. 선생님에게 새 코드를 요청해 주세요.';
    }
    if (error.code === 'launch_code_used') {
      return '이미 사용한 입장 코드입니다. 선생님에게 새 코드를 요청해 주세요.';
    }
    if (error.status === 400 || error.status === 401 || error.status === 404) {
      return '반, 학생 코드, 입장 코드를 다시 확인해 주세요.';
    }
  }

  return '입장을 확인하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.';
}

export async function resolveStudentLaunch(input: StudentLaunchResolveInput): Promise<ApiStudentSessionContext> {
  const payload = await apiRequest<StudentLaunchResolveResult>('/api/student/resolve', {
    method: 'POST',
    body: JSON.stringify({
      classId: input.classId.trim(),
      studentCode: input.studentCode.trim(),
      launchCode: input.launchCode.trim()
    })
  });

  return {
    mode: 'api',
    classId: payload.student.classId,
    studentId: payload.student.id,
    studentToken: payload.studentToken,
    startedAt: new Date().toISOString()
  };
}

export async function createExplorationSession(context: ApiStudentSessionContext, selectedJobId: string): Promise<string> {
  const payload = await apiRequest<{ sessionId: string }>('/api/exploration-sessions', {
    method: 'POST',
    headers: studentContextHeaders(context),
    body: JSON.stringify({
      classId: context.classId,
      studentId: context.studentId,
      selectedJobId,
      phase: 'learning'
    })
  });
  return payload.sessionId;
}

export async function createExplorationSessionEvent(context: ApiStudentSessionContext, input: ExplorationSessionEventInput): Promise<string | null> {
  if (!context.sessionId) return null;
  const payload = await apiRequest<{ eventId: string }>(`/api/exploration-sessions/${encodeURIComponent(context.sessionId)}/events`, {
    method: 'POST',
    headers: studentContextHeaders(context),
    body: JSON.stringify(input)
  });
  return payload.eventId;
}

export async function createExplorationSessionResponse(context: ApiStudentSessionContext, input: ExplorationSessionResponseInput): Promise<string | null> {
  if (!context.sessionId) return null;
  const payload = await apiRequest<{ responseId: string }>(`/api/exploration-sessions/${encodeURIComponent(context.sessionId)}/responses`, {
    method: 'POST',
    headers: studentContextHeaders(context),
    body: JSON.stringify(input)
  });
  return payload.responseId;
}

export async function createExplorationSessionRecord(context: ApiStudentSessionContext, input: ExplorationSessionRecordInput): Promise<string | null> {
  if (!context.sessionId) return null;
  const payload = await apiRequest<{ recordId: string }>(`/api/exploration-sessions/${encodeURIComponent(context.sessionId)}/records`, {
    method: 'POST',
    headers: studentContextHeaders(context),
    body: JSON.stringify(input)
  });
  return payload.recordId;
}

export async function completeExplorationSession(context: ApiStudentSessionContext): Promise<void> {
  if (!context.sessionId) return;
  await apiRequest<{ ok: boolean }>(`/api/exploration-sessions/${encodeURIComponent(context.sessionId)}/complete`, {
    method: 'PATCH',
    headers: studentContextHeaders(context),
    body: JSON.stringify({})
  });
}

export async function fetchTeacherMe(): Promise<TeacherSession> {
  const payload = await apiRequest<{ teacher: TeacherSession }>('/api/auth/me');
  return payload.teacher;
}

export async function fetchTeacherClasses(): Promise<TeacherClassSummary[]> {
  const payload = await apiRequest<{ classes: TeacherClassSummary[] }>('/api/classes');
  return payload.classes;
}

export async function fetchClassStudents(classId: string): Promise<TeacherRosterStudent[]> {
  const payload = await apiRequest<{ students: TeacherRosterStudent[] }>(`/api/classes/${encodeURIComponent(classId)}/students`);
  return payload.students;
}

export async function createRosterStudent(classId: string, input: TeacherRosterStudentInput): Promise<TeacherRosterStudent> {
  const payload = await apiRequest<{ student: TeacherRosterStudent }>(`/api/classes/${encodeURIComponent(classId)}/students`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
  return payload.student;
}

export async function updateRosterStudent(studentId: string, input: Partial<TeacherRosterStudentInput>): Promise<TeacherRosterStudent> {
  const payload = await apiRequest<{ student: TeacherRosterStudent }>(`/api/students/${encodeURIComponent(studentId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
  return payload.student;
}

export async function generateStudentLaunchCode(studentId: string): Promise<TeacherLaunchCodeResult> {
  return apiRequest<TeacherLaunchCodeResult>(`/api/students/${encodeURIComponent(studentId)}/launch-code`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

function getScene(state: AppState, job: JobProfile) {
  return job.scenes.find((item) => item.id === state.selectedSceneId) ?? job.scenes[state.currentSceneIndex] ?? job.scenes[0];
}

function buildTeacherEvidenceFields({
  state,
  job,
  expression,
  supportUsed,
  responseMode
}: {
  state: AppState;
  job: JobProfile;
  expression: string;
  supportUsed: string[];
  responseMode: TeacherLog['responseMode'];
}): Pick<
  TeacherLog,
  | 'sessionId'
  | 'studentId'
  | 'jobId'
  | 'sceneId'
  | 'responseMode'
  | 'studentExpression'
  | 'supportUsed'
  | 'sceneTurnReached'
  | 'evidenceCandidates'
  | 'nextInstructionGuide'
  | 'teacherDecisionRequired'
  | 'masteryReviewTarget'
  | 'aiSuggestionId'
> {
  const scene = getScene(state, job);
  const sceneTitle = scene.label.replace(/^\d+\s*/, '');
  const reached = state.sceneTurnCount >= 2 ? 'practice_support' : state.sceneTurnCount === 1 ? 'meaning' : 'observe';
  const supportSummary = supportUsed.length ? supportUsed.join(', ') : '지원 사용 기록 없음';
  const needsSupportFollowUp = supportUsed.some((item) => item === 'visual' || item === 'pause' || item === 'teacher_prompt');
  const teacherEvidenceTarget = state.teacherEvidenceTarget;
  const masteryReviewTarget = teacherEvidenceTarget?.masteryReviewTarget;

  return {
    sessionId: teacherEvidenceTarget?.sessionId ?? `local-session-${job.id}-${scene.id}`,
    studentId: masteryReviewTarget?.studentId ?? teacherEvidenceTarget?.studentId ?? 'demo-student-hong',
    jobId: job.id,
    sceneId: scene.id,
    responseMode,
    studentExpression: expression,
    supportUsed,
    sceneTurnReached: reached,
    evidenceCandidates: [
      {
        criterionKey: 'observe_scene_target',
        title: `${sceneTitle} 장면 단서 관찰`,
        candidateLevel: needsSupportFollowUp ? 'with_support' : 'emerging',
        candidateStatus: needsSupportFollowUp ? 'support_needed' : 'needs_review',
        summary: `${expression} 표현은 ${sceneTitle} 장면의 후보 근거입니다.`,
        supportSummary,
        teacherReviewQuestion: '이 표현을 다음 지도에 쓸 후보 근거로 둘까요?'
      }
    ],
    nextInstructionGuide: [
      {
        id: 'same-scene-fewer-choices',
        action: `${sceneTitle} 장면을 선택지 2개로 줄여 다시 제시합니다.`,
        reason: '학생 표현을 같은 장면에서 한 번 더 확인하면 다음 수업 연결이 쉽습니다.'
      },
      {
        id: 'photo-object-match',
        action: '실물 사진이나 교구를 놓고 학생이 같은 대상을 고르게 합니다.',
        reason: '그림 속 단서를 실제 수업 자료와 연결할 수 있습니다.'
      }
    ],
    teacherDecisionRequired: ['후보 근거 채택 여부', '지원 사용 기록 확인', '다음 수업 활동 선택'],
    masteryReviewTarget,
    aiSuggestionId: teacherEvidenceTarget?.aiSuggestionId
  };
}

function reviewStatusForDecision(decision: TeacherDecision) {
  if (decision === 'accepted') return 'teacher_confirmed';
  if (decision === 'edited') return 'evidence_sufficient';
  return 'needs_more_evidence';
}

export async function persistTeacherDecision(
  log: TeacherLog,
  decision: TeacherDecision,
  note: string
): Promise<{ persistedVia: TeacherDecisionPersistence; id?: string }> {
  if (log.aiSuggestionId) {
    const response = await fetch(`/api/teacher/ai-assistance/suggestions/${encodeURIComponent(log.aiSuggestionId)}/decisions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        decision,
        editedText: decision === 'edited' ? note : undefined,
        teacherNote: note,
        appliedTo: 'teacher_log',
        appliedTeacherLogId: log.id
      })
    });
    if (!response.ok) throw new Error(`teacher_ai_decision_failed_${response.status}`);
    const result = await response.json() as { decisionId?: string };
    return { persistedVia: 'ai-assistance-decision-api', id: result.decisionId };
  }

  if (log.masteryReviewTarget) {
    const target = log.masteryReviewTarget;
    const response = await fetch('/api/teacher/mastery/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        studentId: target.studentId,
        criteriaSetId: target.criteriaSetId,
        criterionId: target.criterionId,
        learningUnitId: target.learningUnitId,
        reviewSource: target.reviewSource ?? 'teacher_dashboard',
        reviewStatus: reviewStatusForDecision(decision),
        reviewNote: note
      })
    });
    if (!response.ok) throw new Error(`teacher_mastery_review_failed_${response.status}`);
    const result = await response.json() as { reviewId?: string };
    return { persistedVia: 'mastery-review-api', id: result.reviewId };
  }

  return { persistedVia: 'local' };
}

export const mockCoachGateway: CoachGateway = {
  createSupportLog(action: SupportActionId, state: AppState, job: JobProfile) {
    if (action !== 'help' && action !== 'pause' && action !== 'visual') return null;

    const signal = action === 'pause' ? '쉬기/전환' : action === 'help' ? '도움 필요' : '모름/불확실';
    const supportLevel = action === 'visual' ? '시각+선택 중심' : '교사 확인 대기';
    const actionLabel = action === 'pause' ? '잠깐 쉬기' : action === 'help' ? '도움 요청 발생' : '그림으로 보기';
    const supportUsed = action === 'pause' ? ['pause'] : action === 'help' ? ['teacher_prompt'] : ['visual'];

    return {
      id: nowId('log'),
      createdAt: new Date().toISOString(),
      studentName: '홍길동 학생',
      jobTitle: job.title,
      stageLabel: state.currentSceneIndex >= 0 ? job.scenes[state.currentSceneIndex]?.label ?? '탐색 중' : '탐색 중',
      signal,
      supportLevel,
      summary: `${actionLabel}: ${job.title} 활동을 같은 장면에서 다시 지원합니다.`,
      ...buildTeacherEvidenceFields({
        state,
        job,
        expression: actionLabel,
        supportUsed,
        responseMode: action === 'pause' ? 'pause' : action === 'visual' ? 'visual' : 'teacher_support'
      }),
      status: '확인 대기'
    };
  },

  createAacLog(option: AacOption, state: AppState, job: JobProfile) {
    if (option.supportAction === 'replay') return null;

    const scene = getScene(state, job);
    const isSupportChoice = option.type === 'support';

    return {
      id: nowId('aac'),
      createdAt: new Date().toISOString(),
      studentName: '홍길동 학생',
      jobTitle: job.title,
      stageLabel: scene.label,
      signal: isSupportChoice ? '모름/불확실' : '직업 이해',
      supportLevel: 'AAC 지원',
      summary: `AAC 버튼 "${option.label}"을 선택했습니다. ${job.title} ${scene.label.replace(/^\d+\s*/, '')} 장면에서 표현을 이어갑니다.`,
      ...buildTeacherEvidenceFields({
        state,
        job,
        expression: option.value,
        supportUsed: ['aac'],
        responseMode: 'aac'
      }),
      status: '확인 대기'
    };
  }
};

export function createRecord(state: AppState, job: JobProfile): ExplorationRecord {
  const scene = job.scenes.find((item) => item.id === state.selectedSceneId) ?? job.scenes[state.currentSceneIndex] ?? job.scenes[0];
  return {
    id: nowId('record'),
    createdAt: new Date().toISOString(),
    studentName: '홍길동 학생',
    jobId: job.id,
    jobTitle: job.title,
    memorableScene: scene.label.replace(/^\d+\s*/, ''),
    studentThought: state.selectedThought,
    edenNote: `${job.title}에서 ${scene.description} 장면을 기억했습니다. 다음 수업에서는 그림 자료로 한 번 더 살펴보면 좋겠습니다.`,
    logs: state.teacherLogs.slice(-4)
  };
}
