import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import {
  AlertTriangle,
  Bookmark,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coffee,
  ClipboardList,
  Clock3,
  Filter,
  Headphones,
  HeartHandshake,
  HelpCircle,
  House,
  MessageCircle,
  PanelRightOpen,
  Play,
  Power,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import {
  canManageRoster,
  completeExplorationSession,
  createExplorationSession,
  createExplorationSessionEvent,
  createExplorationSessionRecord,
  createExplorationSessionResponse,
  createRecord,
  createRosterStudent,
  fetchClassStudents,
  fetchClassEntrySession,
  fetchTeacherClasses,
  fetchTeacherMe,
  generateStudentLaunchCode,
  getRosterErrorMessage,
  getStudentLaunchErrorMessage,
  isApiStudentSession,
  localSessionRepository,
  mockCoachGateway,
  persistTeacherDecision,
  resolveStudentLaunch,
  startClassEntryStudent,
  startTeacherClassEntrySession,
  updateRosterStudent
} from './adapters';
import { appAssets, getJobVisual, getSceneImage, jobEidenWelcome } from './assets';
import { speakText } from './avatarSpeech';
import { getJob, getSceneAacOptions, getSceneNarration, initialState, jobs, stages } from './data';
import type { AacOption, ApiStudentSessionContext, AppState, ExplorationRecord, JobId, SupportActionId, TeacherDecision, TeacherLog, ViewId } from './domain';
import type { ClassEntryStudent, TeacherClassSummary, TeacherRosterStudent, TeacherSession } from './adapters';
import { getCappedSceneTurnCount, getGuardedStudentSceneTurn, createGuardedSceneReply } from './guardedSceneTurns';
import { LandingHero } from './LandingHero';
import { DayExperience } from './StudentSceneTurnPanel';
import { confirmTeacherLogDecision, getTeacherPersistenceLabel, teacherDecisionOptions } from './teacherDecision';
import { getJobTheme } from './theme';

const bannedCopy = ['점수', '등급', '적합률', '정답률', '정답', '틀렸', '잘했', '실패', '오답', '최종 판정', 'AI 판정', 'AI 최종'];

const stageIndexByView: Record<ViewId, number> = {
  landing: 0,
  launch: 0,
  intro: 1,
  day: 2,
  summary: 4,
  saved: 5,
  records: 5,
  teacher: 5
};

const sourceAlignJobId: JobId = 'barista-aide';
const sourceAlignSceneId = 'clean';

function getSourceAlignmentScene() {
  const sourceJob = getJob(sourceAlignJobId);
  return sourceJob.scenes.find((scene) => scene.id === sourceAlignSceneId) ?? sourceJob.scenes[sourceJob.scenes.length - 1];
}

const viewLabels: Record<ViewId, string> = {
  landing: '처음',
  launch: '학생 입장',
  intro: '직업 소개',
  day: '하루 체험',
  summary: '탐색 정리',
  saved: '저장 완료',
  records: '내 기록',
  teacher: '교사 보기'
};

type AppHistoryState = {
  kkumideunView?: ViewId;
};

type StudentLaunchPrefill = {
  classId: string;
  studentCode: string;
};

type ClassEntrySession = {
  entryToken?: string;
  classLabel: string;
  students: ClassEntryStudent[];
};

type TeacherDashboardPageId = 'records' | 'students';
export const teacherDashboardNavigation: Array<{
  id: TeacherDashboardPageId;
  label: string;
  Icon: typeof ClipboardList;
}> = [
  { id: 'records', label: '학생 기록', Icon: ClipboardList },
  { id: 'students', label: '학생 관리', Icon: Users }
];

function trimLaunchQueryValue(value: string | null) {
  return value?.trim().slice(0, 80) ?? '';
}

export function getStudentLaunchPrefillFromSearch(search: string): StudentLaunchPrefill | null {
  const params = new URLSearchParams(search);
  if (params.get('entry') !== 'student') return null;
  const classId = trimLaunchQueryValue(params.get('classId'));
  const studentCode = trimLaunchQueryValue(params.get('studentCode'));
  if (!classId || !studentCode) return null;
  return { classId, studentCode };
}

function getStudentLaunchPrefillFromLocation(): StudentLaunchPrefill | null {
  if (typeof window === 'undefined') return null;
  return getStudentLaunchPrefillFromSearch(window.location.search);
}

export function getClassEntryTokenFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const token = params.get('classEntry');
  return token?.trim().slice(0, 160) || null;
}

function getClassEntryTokenFromLocation() {
  if (typeof window === 'undefined') return null;
  return getClassEntryTokenFromSearch(window.location.search);
}

export function buildStudentEntryUrl(origin: string, pathname: string, input: StudentLaunchPrefill) {
  const url = new URL(pathname || '/', origin);
  url.searchParams.set('entry', 'student');
  url.searchParams.set('classId', input.classId);
  url.searchParams.set('studentCode', input.studentCode);
  return url.toString();
}

export function buildClassEntryUrl(origin: string, pathname: string, entryToken: string) {
  const url = new URL(pathname || '/', origin);
  url.searchParams.set('classEntry', entryToken);
  return url.toString();
}

function replaceClassEntryTokenInLocation(entryToken: string) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('entry');
  url.searchParams.delete('classId');
  url.searchParams.delete('studentCode');
  url.searchParams.set('classEntry', entryToken);
  window.history.replaceState({ kkumideunView: 'landing' } satisfies AppHistoryState, '', url.toString());
}

export function getAppHistoryView(value: unknown): ViewId | null {
  if (!value || typeof value !== 'object') return null;
  const historyView = (value as AppHistoryState).kkumideunView;
  if (
    historyView === 'landing' ||
    historyView === 'launch' ||
    historyView === 'intro' ||
    historyView === 'day' ||
    historyView === 'summary' ||
    historyView === 'saved' ||
    historyView === 'records' ||
    historyView === 'teacher'
  ) {
    return historyView;
  }
  return null;
}

function writeHistoryView(view: ViewId, mode: 'push' | 'replace') {
  if (typeof window === 'undefined') return;
  const historyState: AppHistoryState = { kkumideunView: view };
  if (mode === 'replace') {
    window.history.replaceState(historyState, '', window.location.href);
    return;
  }
  window.history.pushState(historyState, '', window.location.href);
}

export function mergePersistedStateForInitialLoad(loaded: Partial<AppState> | null, launchPrefill: StudentLaunchPrefill | null = null): AppState {
  return {
    ...initialState,
    ...(loaded ?? {}),
    view: 'landing',
    selectedJobId: loaded?.selectedJobId ?? 'barista-aide',
    studentSession: undefined,
    teacherEvidenceTarget: undefined,
    visualSupportOpen: false,
    resting: false,
    replaying: false,
    teacherLogs: loaded?.teacherLogs?.length ? loaded.teacherLogs : initialState.teacherLogs,
    records: sortRecordsByLatest(loaded?.records ?? [])
  };
}

function mergeLoadedState(launchPrefill: StudentLaunchPrefill | null): AppState {
  return mergePersistedStateForInitialLoad(localSessionRepository.load(), launchPrefill);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)).replace(/ /g, '');
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(value)).replace(/ /g, '');
}

function formatMinutesAgo(value: string) {
  const minutes = Math.max(8, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  return `${minutes}분`;
}

function sortRecordsByLatest(records: ExplorationRecord[]) {
  return [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function avatarSpeechContext(state: AppState) {
  if (isApiStudentSession(state.studentSession)) {
    return {
      sessionId: state.studentSession.sessionId,
      studentToken: state.studentSession.studentToken
    };
  }

  return {
    sessionId: state.teacherEvidenceTarget?.sessionId
  };
}

export function applyResolvedStudentContext(state: AppState, context: ApiStudentSessionContext): AppState {
  return {
    ...state,
    view: 'intro',
    studentSession: context,
    teacherEvidenceTarget: {
      ...state.teacherEvidenceTarget,
      studentId: context.studentId,
      sessionId: context.sessionId
    }
  };
}

export function applyStartedStudentSession(state: AppState, sessionId: string): AppState {
  if (!isApiStudentSession(state.studentSession)) return state;
  const nextSession = {
    ...state.studentSession,
    sessionId
  };
  return {
    ...state,
    studentSession: nextSession,
    teacherEvidenceTarget: {
      ...state.teacherEvidenceTarget,
      studentId: nextSession.studentId,
      sessionId
    }
  };
}

function getThoughtTone(thought: string) {
  if (thought.includes('어려웠')) return 'thought-help';
  if (thought.includes('알아볼래')) return 'thought-next';
  return 'thought-proud';
}

function findSceneForLabel(job: ReturnType<typeof getJob>, label: string) {
  const normalized = label.replace(/^\d+\s*/, '').trim();
  return job.scenes.find((scene) => scene.label.replace(/^\d+\s*/, '').trim() === normalized);
}

function getRecordSceneImage(record?: ExplorationRecord) {
  if (!record) return getSceneImage('barista-aide', 'prep');
  const job = getJob(record.jobId);
  const scene = findSceneForLabel(job, record.memorableScene) ?? job.scenes[0];
  return getSceneImage(job.id, scene.id);
}

function getLogVisual(log: TeacherLog) {
  const job = getJob(jobIdForTitle(log.jobTitle));
  const matchedScene =
    job.scenes.find((scene) => log.stageLabel.includes(scene.label.replace(/^\d+\s*/, ''))) ??
    job.scenes.find((scene) => log.summary.includes(scene.label.replace(/^\d+\s*/, ''))) ??
    job.scenes[0];

  return {
    job,
    scene: matchedScene,
    image: getSceneImage(job.id, matchedScene.id)
  };
}

function getTeacherExpression(log: TeacherLog) {
  if (log.studentExpression) return log.studentExpression;
  const quoted = log.summary.match(/"([^"]+)"/)?.[1];
  if (quoted) return quoted;
  if (log.signal === '도움 필요') return '도와주세요';
  if (log.signal === '모름/불확실') return '다시 볼래요';
  if (log.signal === '쉬기/전환') return '잠깐 쉬어요';
  if (log.signal === '직업 이해') return '알아봤어요';
  return '준비해요';
}

const supportLabels: Record<NonNullable<TeacherLog['supportUsed']>[number], string> = {
  aac: 'AAC 선택',
  visual: '그림 자료',
  pause: '쉬기 선택',
  teacher_prompt: '교사 도움'
};

const responseModeLabels: Record<NonNullable<TeacherLog['responseMode']>, string> = {
  aac: 'AAC',
  touch: '터치 선택',
  teacher_support: '교사 도움',
  visual: '그림 자료',
  pause: '쉬기 선택',
  none: '기록 없음'
};

const sceneTurnLabels: Record<NonNullable<TeacherLog['sceneTurnReached']>, string> = {
  observe: '장면 살펴보기',
  meaning: '일의 의미 연결',
  practice_support: '연습 또는 지원 연결'
};

const candidateLevelLabels: Record<NonNullable<TeacherLog['evidenceCandidates']>[number]['candidateLevel'], string> = {
  not_observed: '관찰 기록 없음',
  emerging: '새로 보인 단서',
  with_support: '지원과 함께 보인 단서',
  independent: '스스로 보인 단서'
};

const candidateStatusLabels: Record<NonNullable<TeacherLog['evidenceCandidates']>[number]['candidateStatus'], string> = {
  needs_review: '교사 확인 필요',
  support_needed: '지원 방법 확인',
  observed: '관찰 기록',
  accepted: '교사 확인 기록'
};

function getSupportUsageText(log: TeacherLog) {
  const supports = log.supportUsed ?? [];
  if (!supports.length) return '지원 사용 기록 없음';
  return supports.map((item) => supportLabels[item] ?? item).join(', ');
}

function getFallbackNextInstruction(log: TeacherLog) {
  if (log.signal === '도움 필요' || log.signal === '모름/불확실') {
    return [
      {
        id: 'same-scene-fewer-choices',
        action: `${log.stageLabel} 장면을 선택지 2개로 줄여 다시 제시합니다.`,
        reason: '학생이 같은 장면을 부담 없이 다시 볼 수 있게 합니다.'
      }
    ];
  }

  return [
    {
      id: 'photo-object-match',
      action: `${log.jobTitle} 사진이나 교구를 놓고 학생 표현과 같은 대상을 고르게 합니다.`,
      reason: '학생이 남긴 표현을 다음 수업 자료와 연결합니다.'
    }
  ];
}

export function buildTeacherSessionSummary(log: TeacherLog) {
  const expression = getTeacherExpression(log);
  const candidates = log.evidenceCandidates?.length
    ? log.evidenceCandidates
    : [
        {
          criterionKey: 'session_expression',
          title: `${log.stageLabel} 학생 표현`,
          candidateLevel: 'emerging' as const,
          candidateStatus: 'needs_review' as const,
          summary: `${expression} 표현을 다음 수업에서 다시 확인할 후보 근거로 둡니다.`,
          supportSummary: getSupportUsageText(log),
          teacherReviewQuestion: '이 표현을 다음 지도에 쓸 후보 근거로 둘까요?'
        }
      ];
  const nextInstructionGuide = log.nextInstructionGuide?.length ? log.nextInstructionGuide : getFallbackNextInstruction(log);

  return {
    summaryForTeacher: `${log.studentName}은 ${log.jobTitle} ${log.stageLabel}에서 ${expression}을 기록했습니다. 이 내용은 교사가 확인해야 하는 수업 후보 근거입니다.`,
    sceneEvidence: candidates.map((candidate) => ({
      ...candidate,
      candidateLevelLabel: candidateLevelLabels[candidate.candidateLevel],
      candidateStatusLabel: candidateStatusLabels[candidate.candidateStatus]
    })),
    supportUsage: getSupportUsageText(log),
    responseMode: responseModeLabels[log.responseMode ?? 'none'],
    sceneTurnReached: sceneTurnLabels[log.sceneTurnReached ?? 'observe'],
    nextInstructionGuide,
    teacherDecisionRequired: log.teacherDecisionRequired?.length
      ? log.teacherDecisionRequired
      : ['후보 근거 채택 여부', '지원 사용 기록 확인', '다음 수업 활동 선택']
  };
}

const introMessages: Record<JobId, string> = {
  'barista-aide': '바리스타가 일하는 장면을 하나씩 볼게요.',
  'library-aide': '도서관 사서가 일하는 장면을 하나씩 볼게요.',
  'baker-aide': '제빵사가 일하는 장면을 하나씩 볼게요.'
};

export function getIntroContent(job: ReturnType<typeof getJob>) {
  return {
    message: introMessages[job.id],
    cta: '하루 체험하기',
    nextView: 'day' as ViewId
  };
}

export function getNextIntroJobId(jobId: JobId): JobId {
  const currentIndex = jobs.findIndex((job) => job.id === jobId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % jobs.length : 0;
  return jobs[nextIndex].id;
}

export function getSummaryStudentExpression(option: AacOption | null) {
  return option ? `${option.label} 선택` : '아직 표현을 고르지 않았어요';
}

export function getSummaryEncouragement(jobTitle: string, sceneTitle: string, option: AacOption | null) {
  if (!option) {
    return '괜찮아요. 이든과 장면을 다시 보면서 천천히 표현을 고를 수 있어요.';
  }

  return `${option.label}을 고른 건 ${sceneTitle} 장면에서 보인 것을 스스로 짚어 본 거예요. ${jobTitle} 일을 알아가는 중요한 선택이에요.`;
}

export function getSummaryMotivation(sceneTitle: string, selectedThought: string) {
  return `${sceneTitle}을 기억하고 "${selectedThought}"라고 정리해 두면 다음 수업에서 다시 시작하기 쉬워요.`;
}

function scrollToPageTop() {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
}

export function App() {
  const [state, setState] = useState<AppState>(() => mergeLoadedState(getStudentLaunchPrefillFromLocation()));
  const [summaryJobId, setSummaryJobId] = useState<JobId>(sourceAlignJobId);
  const [summarySceneId, setSummarySceneId] = useState<string>(getSourceAlignmentScene().id);
  const [studentSessionStarting, setStudentSessionStarting] = useState(false);
  const [classEntrySession, setClassEntrySession] = useState<ClassEntrySession | null>(null);
  const [classEntryToken, setClassEntryToken] = useState<string | null>(() => getClassEntryTokenFromLocation());
  const [classEntryLoading, setClassEntryLoading] = useState(false);
  const [classEntryModalOpen, setClassEntryModalOpen] = useState(false);
  const [classEntryJobId, setClassEntryJobId] = useState<JobId | null>(null);
  const [classEntryStudentId, setClassEntryStudentId] = useState<string | null>(null);
  const [classEntryMessage, setClassEntryMessage] = useState<string | null>(null);
  const job = getJob(state.selectedJobId);
  const theme = getJobTheme(job.id);
  const currentScene = job.scenes.find((scene) => scene.id === state.selectedSceneId) ?? job.scenes[state.currentSceneIndex] ?? job.scenes[0];
  const pendingLogs = state.teacherLogs.filter((log) => log.status === '확인 대기');
  const drawerLog = state.teacherLogs.find((log) => log.id === state.teacherDrawerLogId) ?? null;

  useEffect(() => {
    localSessionRepository.save(state);
  }, [state]);

  useEffect(() => {
    writeHistoryView(state.view, 'replace');
    const handlePopState = (event: PopStateEvent) => {
      const view = getAppHistoryView(event.state) ?? 'landing';
      setClassEntryLoading(false);
      setClassEntryModalOpen(false);
      setClassEntryStudentId(null);
      setClassEntryMessage(null);
      setState((current) => ({
        ...current,
        view,
        visualSupportOpen: false,
        resting: false,
        replaying: false
      }));
      scrollToPageTop();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const appClassName = [
    'app',
    `view-${state.view}`,
    `job-${job.accent}`,
    state.resting ? 'is-resting' : '',
    state.visualSupportOpen ? 'has-modal' : ''
  ].filter(Boolean).join(' ');
  const appStyle = {
    '--theme-bg': theme.bg,
    '--theme-text': theme.text,
    '--theme-accent': theme.accent,
    '--theme-ghost': theme.ghost,
    '--theme-glow': theme.glow
  } as CSSProperties;

  function update(partial: Partial<AppState>) {
    setState((current) => ({ ...current, ...partial }));
  }

  function go(view: ViewId) {
    writeHistoryView(view, 'push');
    update({ view, visualSupportOpen: false, resting: false, replaying: false });
    scrollToPageTop();
  }

  function chooseJob(jobId: JobId) {
    const nextJob = getJob(jobId);
    const nextStudentSession = isApiStudentSession(state.studentSession)
      ? { ...state.studentSession, sessionId: undefined }
      : state.studentSession;
    update({
      selectedJobId: jobId,
      selectedSceneId: nextJob.scenes[0].id,
      currentSceneIndex: 0,
      selectedAacOptionId: null,
      coachReply: null,
      sceneTurnCount: 0,
      replaying: false,
      resting: false,
      studentSession: nextStudentSession,
      teacherEvidenceTarget: nextStudentSession?.mode === 'api'
        ? {
            ...state.teacherEvidenceTarget,
            studentId: nextStudentSession.studentId,
            sessionId: undefined
          }
        : state.teacherEvidenceTarget
    });
  }

  function startIntroForJob(jobId: JobId) {
    const nextJob = getJob(jobId);

    setClassEntryMessage(null);
    setClassEntryJobId(null);
    writeHistoryView('intro', 'push');
    setState((current) => ({
      ...current,
      selectedJobId: jobId,
      selectedSceneId: nextJob.scenes[0].id,
      currentSceneIndex: 0,
      selectedAacOptionId: null,
      coachReply: null,
      sceneTurnCount: 0,
      visualSupportOpen: false,
      resting: false,
      replaying: false,
      view: 'intro',
      studentSession: undefined,
      teacherEvidenceTarget: undefined
    }));
    scrollToPageTop();
  }

  function prepareClassEntrySession(session: ClassEntrySession) {
    setClassEntrySession(session);
    setClassEntryToken(session.entryToken ?? null);
    setClassEntryLoading(false);
    setClassEntryModalOpen(false);
    setClassEntryJobId(null);
    setClassEntryStudentId(null);
    setClassEntryMessage(null);
    writeHistoryView('landing', 'push');
    if (session.entryToken) replaceClassEntryTokenInLocation(session.entryToken);
    setState((current) => ({
      ...current,
      view: 'landing',
      studentSession: undefined,
      teacherEvidenceTarget: undefined,
      visualSupportOpen: false,
      resting: false,
      replaying: false
    }));
    scrollToPageTop();
  }

  async function openClassEntryNamePicker() {
    setClassEntryJobId(state.selectedJobId);
    setClassEntryMessage(null);

    if (classEntrySession?.students.length) {
      setClassEntryModalOpen(true);
      return;
    }

    setClassEntrySession((current) => current ?? { classLabel: '학생 이름 선택', students: [] });
    setClassEntryModalOpen(true);
    setClassEntryLoading(true);

    try {
      const entryToken = classEntrySession?.entryToken ?? classEntryToken ?? getClassEntryTokenFromLocation();
      if (entryToken) {
        const entrySession = await fetchClassEntrySession(entryToken);
        setClassEntryToken(entryToken);
        setClassEntrySession({
          entryToken,
          classLabel: entrySession.class.name,
          students: entrySession.students
        });
        if (!entrySession.students.length) {
          setClassEntryMessage('등록된 학생이 없습니다. 선생님이 학생 관리에서 학생을 먼저 등록해야 합니다.');
        }
        return;
      }

      const nextClasses = await fetchTeacherClasses();
      const nextClass = nextClasses.find((item) => item.active) ?? nextClasses[0];

      if (!nextClass) {
        setClassEntrySession({ classLabel: '학생 이름 선택', students: [] });
        setClassEntryMessage('아직 등록된 반이 없습니다. 선생님이 학생 관리에서 반과 학생을 먼저 등록해야 합니다.');
        return;
      }

      const nextStudents = (await fetchClassStudents(nextClass.id)).filter((student) => student.active);
      setClassEntrySession({ classLabel: nextClass.name, students: nextStudents });
      if (!nextStudents.length) {
        setClassEntryMessage('등록된 학생이 없습니다. 선생님이 학생 관리에서 학생을 먼저 등록해야 합니다.');
      }
    } catch {
      setClassEntrySession({ classLabel: '학생 이름 선택', students: [] });
      setClassEntryMessage('학생 이름 목록을 불러오지 못했습니다. 선생님 화면에서 학생 관리를 먼저 열어 주세요.');
    } finally {
      setClassEntryLoading(false);
    }
  }

  async function enterDayFromIntro() {
    if (!state.studentSession) {
      await openClassEntryNamePicker();
      return;
    }

    if (state.studentSession.mode === 'demo') {
      go('day');
      return;
    }

    if (state.studentSession.sessionId) {
      go('day');
      return;
    }

    setStudentSessionStarting(true);
    try {
      const sessionId = await createExplorationSession(state.studentSession, state.selectedJobId);
      writeHistoryView('day', 'push');
      setState((current) => ({
        ...applyStartedStudentSession(current, sessionId),
        view: 'day',
        visualSupportOpen: false,
        resting: false,
        replaying: false
      }));
      scrollToPageTop();
    } catch {
      go('landing');
    } finally {
      setStudentSessionStarting(false);
    }
  }

  async function startClassEntryStudentFlow(student: ClassEntryStudent) {
    if (!classEntrySession || classEntryStudentId) return;

    const nextJobId = classEntryJobId ?? state.selectedJobId;
    const nextJob = getJob(nextJobId);
    setClassEntryStudentId(student.id);
    setClassEntryMessage(null);
    setStudentSessionStarting(true);
    try {
      const context = classEntrySession.entryToken
        ? await startClassEntryStudent(classEntrySession.entryToken, student.id)
        : await startClassEntryStudentWithTeacherSession(student);
      const sessionId = await createExplorationSession(context, nextJobId);
      const startedContext: ApiStudentSessionContext = { ...context, sessionId };
      writeHistoryView('day', 'push');
      setState((current) => ({
        ...applyResolvedStudentContext({
          ...current,
          selectedJobId: nextJobId,
          selectedSceneId: nextJob.scenes[0].id,
          currentSceneIndex: 0,
          selectedAacOptionId: null,
          coachReply: null,
          sceneTurnCount: 0,
          visualSupportOpen: false,
          resting: false,
          replaying: false
        }, startedContext),
        view: 'day'
      }));
      setClassEntryModalOpen(false);
      setClassEntryMessage(null);
      scrollToPageTop();
    } catch (error) {
      setClassEntryMessage(getStudentLaunchErrorMessage(error));
    } finally {
      setClassEntryStudentId(null);
      setStudentSessionStarting(false);
    }
  }

  async function startClassEntryStudentWithTeacherSession(student: ClassEntryStudent) {
    if (!('studentCode' in student) || typeof student.studentCode !== 'string') {
      throw new Error('student_code_required');
    }

    const issuedCode = await generateStudentLaunchCode(student.id);
    return resolveStudentLaunch({
      classId: student.classId,
      studentCode: student.studentCode,
      launchCode: issuedCode.launchCode
    });
  }

  function currentApiStudentSession() {
    return isApiStudentSession(state.studentSession) && state.studentSession.sessionId ? state.studentSession : null;
  }

  function persistStudentSupportEvent(action: SupportActionId) {
    const session = currentApiStudentSession();
    if (!session || action === 'replay') return;
    const inputMode = action === 'pause' ? 'pause' : action === 'help' ? 'help' : 'picture';
    const eventType = action === 'pause' ? 'pause_requested' : action === 'help' ? 'help_requested' : 'visual_support';
    void createExplorationSessionEvent(session, {
      eventType,
      stage: 'day',
      jobSceneId: currentScene.id,
      inputMode,
      payload: {
        summary: `${job.title} ${currentScene.label.replace(/^\d+\s*/, '')} 장면에서 학생 지원을 요청했습니다.`
      }
    }).catch(() => undefined);
  }

  function persistStudentAacResponse(option: AacOption, interpretedResponse: string) {
    const session = currentApiStudentSession();
    if (!session || option.supportAction) return;
    void createExplorationSessionResponse(session, {
      jobSceneId: currentScene.id,
      inputMode: 'aac',
      responseModality: 'aac',
      selectedValue: option.value,
      interpretedResponse,
      supportUsed: 'aac'
    }).catch(() => undefined);
  }

  function showNextIntroJob() {
    chooseJob(getNextIntroJobId(state.selectedJobId));
    scrollToPageTop();
  }

  function supportAction(action: SupportActionId) {
    const log = mockCoachGateway.createSupportLog(action, state, job);
    const turn = getGuardedStudentSceneTurn(job.id, currentScene, state.sceneTurnCount);
    setState((current) => ({
      ...current,
      replaying: action === 'replay',
      visualSupportOpen: action === 'visual' ? true : current.visualSupportOpen,
      resting: action === 'pause',
      teacherLogs: log ? [...current.teacherLogs, log] : current.teacherLogs
    }));

    if (action === 'replay') {
      void speakText(turn.voiceScript, avatarSpeechContext(state));
      window.setTimeout(() => setState((current) => ({ ...current, replaying: false })), 2200);
    }
    persistStudentSupportEvent(action);
  }

  function chooseAacOption(option: AacOption) {
    const reply = createGuardedSceneReply({ jobId: job.id, scene: currentScene, option, sceneTurnCount: state.sceneTurnCount });
    const currentTurn = getGuardedStudentSceneTurn(job.id, currentScene, state.sceneTurnCount);
    const supportLog = option.supportAction ? mockCoachGateway.createSupportLog(option.supportAction, state, job) : null;
    const aacLog = option.supportAction ? null : mockCoachGateway.createAacLog(option, state, job);
    const log = supportLog ?? aacLog;

    setState((current) => ({
      ...current,
      selectedAacOptionId: option.id,
      coachReply: reply,
      sceneTurnCount: option.supportAction ? current.sceneTurnCount : getCappedSceneTurnCount(current.sceneTurnCount + 1),
      replaying: option.supportAction === 'replay',
      visualSupportOpen: option.supportAction === 'visual' ? true : current.visualSupportOpen,
      resting: option.supportAction === 'pause',
      teacherLogs: log ? [...current.teacherLogs, log] : current.teacherLogs
    }));

    if (option.supportAction === 'replay') {
      void speakText(currentTurn.voiceScript, avatarSpeechContext(state));
      window.setTimeout(() => setState((current) => ({ ...current, replaying: false })), 2200);
    }
    persistStudentAacResponse(option, reply);
  }

  function beginSummaryFromDay() {
    setSummaryJobId(state.selectedJobId);
    setSummarySceneId(state.selectedSceneId);
  }

  function saveExploration() {
    const savedSummaryState = {
      ...state,
      selectedJobId: summaryJobId,
      selectedSceneId: summarySceneId
    };
    const summaryJob = getJob(savedSummaryState.selectedJobId);
    const record = createRecord(savedSummaryState, summaryJob);
    const session = currentApiStudentSession();
    if (session) {
      void createExplorationSessionRecord(session, {
        memorableSceneId: summarySceneId,
        studentThought: savedSummaryState.selectedThought,
        edenNote: record.edenNote
      })
        .then(() => completeExplorationSession(session))
        .catch(() => undefined);
    }
    setState((current) => ({
      ...current,
      records: [record, ...current.records],
      view: 'saved'
    }));
    writeHistoryView('saved', 'push');
    scrollToPageTop();
  }

  async function confirmLog(logId: string, decision: TeacherDecision, note = '') {
    const log = state.teacherLogs.find((item) => item.id === logId);
    if (!log) return;

    const decidedLog = await confirmTeacherLogDecision(log, decision, note, persistTeacherDecision);

    setState((current) => ({
      ...current,
      teacherLogs: current.teacherLogs.map((item) => (item.id === logId ? decidedLog : item))
    }));
  }

  return (
    <div className={appClassName} style={appStyle}>
      <div className="responsive-prototype" data-testid="real-ui">
        {state.view !== 'landing' &&
          state.view !== 'launch' &&
          state.view !== 'teacher' &&
          state.view !== 'day' &&
          state.view !== 'summary' &&
          state.view !== 'saved' &&
          state.view !== 'records' && (
          <StudentUtilityNav
            view={state.view}
            pendingCount={pendingLogs.length}
            onHome={() => go('landing')}
            onTeacher={() => go('teacher')}
          />
        )}

        {state.view === 'landing' && (
          <LandingHero
            initialJobId={state.selectedJobId}
            onStart={startIntroForJob}
            onTeacher={() => go('teacher')}
          />
        )}
        {state.view === 'launch' && (
          <JobIntro
            key={`${job.id}-launch`}
            job={job}
            pending={studentSessionStarting || classEntryLoading}
            onNext={enterDayFromIntro}
            onOtherJob={showNextIntroJob}
          />
        )}
        {state.view === 'intro' && (
          <JobIntro
            key={job.id}
            job={job}
            pending={studentSessionStarting || classEntryLoading}
            onNext={enterDayFromIntro}
            onOtherJob={showNextIntroJob}
          />
        )}
        {state.view === 'day' && (
          <DayExperience
            job={job}
            sceneIndex={state.currentSceneIndex}
            selectedSceneId={state.selectedSceneId}
            selectedAacOptionId={state.selectedAacOptionId}
            coachReply={state.coachReply}
            sceneTurnCount={state.sceneTurnCount}
            replaying={state.replaying}
            resting={state.resting}
            onScene={(index, id) =>
              update({
                currentSceneIndex: index,
                selectedSceneId: id,
                selectedAacOptionId: null,
                coachReply: null,
                sceneTurnCount: 0,
                replaying: false,
                resting: false
              })
            }
            onAacOption={chooseAacOption}
            onSupport={supportAction}
            onBack={() => go('intro')}
            onNext={() => {
                beginSummaryFromDay();
                go('summary');
              }}
          />
        )}
        {state.view === 'summary' && (
          <Summary
            job={getJob(summaryJobId)}
            selectedSceneId={summarySceneId}
            selectedAacOptionId={state.selectedAacOptionId}
            coachReply={state.coachReply}
            selectedThought={state.selectedThought}
            onBack={() => go('day')}
            onScene={(id) => setSummarySceneId(id)}
            onThought={(thought) => update({ selectedThought: thought })}
            onSave={saveExploration}
          />
        )}
        {state.view === 'saved' && (
          <Saved
            job={getJob(summaryJobId)}
            selectedSceneId={summarySceneId}
            record={state.records[0]}
            onBack={() => go('summary')}
            onOtherJob={() => go('intro')}
            onRecords={() => go('records')}
            onHome={() => go('landing')}
          />
        )}
        {state.view === 'records' && (
          <Records
            records={state.records}
            onBack={() => go('saved')}
            onOtherJob={() => go('intro')}
            onSummary={() => go('summary')}
            onTeacher={() => go('teacher')}
          />
        )}
        {state.view === 'teacher' && (
          <TeacherDashboard
            logs={state.teacherLogs}
            records={state.records}
            onOpen={(id) => update({ teacherDrawerLogId: id })}
            onClose={() => update({ teacherDrawerLogId: null })}
            drawerLog={drawerLog}
            onConfirm={confirmLog}
            onStudent={() => go('landing')}
            onClassEntryReady={prepareClassEntrySession}
          />
        )}
      </div>

      {classEntrySession && classEntryModalOpen && (
        <ClassStudentEntryModal
          classLabel={classEntrySession.classLabel}
          students={classEntrySession.students}
          loading={classEntryLoading}
          startingStudentId={classEntryStudentId}
          message={classEntryMessage}
          onClose={() => {
            if (!classEntryStudentId) setClassEntryModalOpen(false);
          }}
          onSelect={startClassEntryStudentFlow}
        />
      )}

      {state.visualSupportOpen && (
        <VisualSupportModal
          jobTitle={job.title}
          scene={currentScene}
          sceneImage={getSceneImage(job.id, currentScene.id)}
          onClose={() => update({ visualSupportOpen: false })}
        />
      )}
    </div>
  );
}

function Header({
  view,
  pendingCount,
  onHome,
  onTeacher
}: {
  view: ViewId;
  pendingCount: number;
  onHome: () => void;
  onTeacher: () => void;
}) {
  const activeStageIndex = Math.min(stageIndexByView[view], stages.length - 1);
  return (
    <header className="app-header">
      <button className="brand-button" type="button" onClick={onHome} aria-label="처음 화면으로 이동">
        <span className="brand-mark" aria-hidden="true">
          <Sparkles size={27} strokeWidth={2.5} />
        </span>
        <span>
          <strong>꿈이든</strong>
          <em>내일탐색</em>
        </span>
      </button>
      <div className="header-center">
        <span>{viewLabels[view]}</span>
        <div className="stage-dots" aria-hidden="true">
          {stages.map((stage, index) => (
            <i key={stage.id} className={index <= activeStageIndex ? 'active' : ''} />
          ))}
        </div>
      </div>
      <button className="teacher-button" type="button" onClick={onTeacher}>
        <PanelRightOpen size={18} />
        교사용으로 보기
        {pendingCount > 0 && <span>{pendingCount}</span>}
      </button>
    </header>
  );
}

function StudentUtilityNav({
  view,
  pendingCount,
  onHome,
  onTeacher
}: {
  view: ViewId;
  pendingCount: number;
  onHome: () => void;
  onTeacher: () => void;
}) {
  const activeStageIndex = Math.min(stageIndexByView[view], stages.length - 1);
  return (
    <nav className="student-utility-nav" aria-label="학생 체험 보조 메뉴">
      <button className="student-brand-button" type="button" onClick={onHome} aria-label="처음 화면으로 이동">
        <Sparkles size={26} strokeWidth={2.6} aria-hidden="true" />
        <span>
          <strong>꿈이든</strong>
          <em>내일탐색</em>
        </span>
      </button>
      <div className="student-view-chip" aria-label={`현재 화면: ${viewLabels[view]}`}>
        <span>{viewLabels[view]}</span>
        <div className="mini-stage-dots" aria-hidden="true">
          {stages.map((stage, index) => (
            <i key={stage.id} className={index <= activeStageIndex ? 'active' : ''} />
          ))}
        </div>
      </div>
      {view !== 'intro' && view !== 'day' && (
        <button
          className="student-mini-button teacher-mini-button"
          type="button"
          onClick={onTeacher}
          aria-label={pendingCount > 0 ? `교사용으로 보기, 확인할 기록 ${pendingCount}건` : '교사용으로 보기'}
        >
          <PanelRightOpen size={21} />
        </button>
      )}
    </nav>
  );
}

function JobIntro({
  job,
  onNext,
  onOtherJob,
  pending = false
}: {
  job: ReturnType<typeof getJob>;
  onNext: () => void;
  onOtherJob: () => void;
  pending?: boolean;
}) {
  const visual = getJobVisual(job.id);
  const intro = getIntroContent(job);
  return (
    <main className="intro-screen" aria-labelledby="intro-title">
      <section className="intro-copy">
        <h2 id="intro-title">{job.title}의 하루를 살펴봐요</h2>
        <div className="intro-listen-row">
          <p>{intro.message}</p>
        </div>
      </section>
      <section className="intro-visual-stage" aria-label={`${job.title} 활동 공간과 이든`}>
        <img className="intro-diorama-art" src={visual.diorama} alt={`${job.title} 활동 공간`} draggable={false} />
        <img className="intro-eiden-art" src={jobEidenWelcome[job.id]} alt={`${job.title} 복장을 한 이든`} draggable={false} />
      </section>
      <div className="intro-actions">
        <button className="primary-cta" type="button" onClick={onNext} disabled={pending}>
          {pending ? '시작 준비 중' : intro.cta}
          <ChevronRight size={20} />
        </button>
        <button className="secondary-cta" type="button" onClick={onOtherJob}>
          다른 직업 보기
          <ChevronRight size={18} />
        </button>
      </div>
    </main>
  );
}

function Summary({
  job,
  selectedSceneId,
  selectedAacOptionId,
  coachReply,
  selectedThought,
  onBack,
  onScene,
  onThought,
  onSave
}: {
  job: ReturnType<typeof getJob>;
  selectedSceneId: string;
  selectedAacOptionId: string | null;
  coachReply: string | null;
  selectedThought: string;
  onBack: () => void;
  onScene: (id: string) => void;
  onThought: (thought: string) => void;
  onSave: () => void;
}) {
  const thoughts = [
    { label: '해보고 싶어요', hint: '스스로 선택했어요', icon: <Sparkles size={18} aria-hidden="true" /> },
    { label: '조금 어려웠어요', hint: '도움이 되었어요', icon: <HeartHandshake size={18} aria-hidden="true" /> },
    { label: '더 알아볼래요', hint: '더 연습하고 싶어요', icon: <Bookmark size={18} aria-hidden="true" /> }
  ];
  const selectedScene = job.scenes.find((scene) => scene.id === selectedSceneId) ?? job.scenes[0];
  const activeSceneIndex = Math.max(0, job.scenes.findIndex((scene) => scene.id === selectedScene.id));
  const sceneNumber = String(activeSceneIndex + 1).padStart(2, '0');
  const sceneTitle = selectedScene.label.replace(/^\d+\s*/, '');
  const selectedSceneImage = getSceneImage(job.id, selectedScene.id);
  const selectedAacOption = getSceneAacOptions(selectedScene).find((option) => option.id === selectedAacOptionId) ?? null;
  const studentExpression = getSummaryStudentExpression(selectedAacOption);
  const studentChoiceDetail = selectedAacOption?.value ?? '표현은 이 화면에서 천천히 다시 고를 수 있어요.';
  const reminderText = coachReply ?? getSceneNarration(selectedScene);
  const encouragementText = getSummaryEncouragement(job.title, sceneTitle, selectedAacOption);
  const motivationText = getSummaryMotivation(sceneTitle, selectedThought);
  const notePrivacyText = '이 기록은 나만 볼 수 있어요.';
  const explanationSteps = [
    {
      label: '1',
      title: selectedScene.description,
      body: `${sceneTitle} 장면에서 ${job.title}가 무엇을 했는지 다시 확인해요.`
    },
    {
      label: '2',
      title: selectedAacOption ? `${selectedAacOption.label} 표현을 기억해요` : '표현을 다시 골라도 괜찮아요',
      body: selectedAacOption ? `${selectedAacOption.value} 마음을 이어서 정리해요.` : '보고 느낀 점을 천천히 다시 골라 볼 수 있어요.'
    },
    {
      label: '3',
      title: '다음 준비를 확인해요',
      body: `${selectedThought} 마음을 기록해 다음 수업과 이어 봐요.`
    }
  ];
  const confidenceBadges = ['스스로 선택했어요', '다시 볼 수 있어요', '다음 수업으로 이어져요'];

  return (
    <main className="summary-screen scene-summary-screen">
      <section className="summary-stage">
        <article className="summary-scene-focus" aria-labelledby="summary-title">
          <header className="summary-page-head">
            <button className="summary-back-button" type="button" onClick={onBack} aria-label="하루 체험으로 돌아가기">
              <ChevronLeft size={22} />
            </button>
            <div className="summary-title-lockup">
              <div>
                <span className="section-label">{job.title}의 하루</span>
                <h2 id="summary-title">탐색 정리</h2>
                <p>방금 고른 장면과 표현을 차분하게 다시 살펴봐요.</p>
              </div>
            </div>
            <div className="summary-stage-bar" aria-label="오늘의 장면 순서">
              {job.scenes.map((scene, index) => (
                <span key={scene.id} className={scene.id === selectedScene.id ? 'active' : ''}>
                  <strong>{String(index + 1).padStart(2, '0')}</strong>
                  {scene.label.replace(/^\d+\s*/, '')}
                </span>
              ))}
            </div>
          </header>

          <section className="summary-layout">
            <aside className="summary-avatar-coach" aria-label="이든의 학습 정리 안내">
              <div className="summary-coach-card">
                <span>이든의 설명</span>
                <p>오늘 배운 {job.title} 마지막 단계예요. 정리하는 방법을 차근차근 확인해 봐요.</p>
                <img className="summary-avatar-image" src={jobEidenWelcome[job.id]} alt="정리를 도와주는 이든" draggable={false} />
              </div>
            </aside>

            <section className="summary-main-board">
              <figure className="summary-scene-anchor" aria-label="오늘 고른 장면">
                <img src={selectedSceneImage} alt="" draggable={false} />
                <figcaption>
                  <span>{sceneNumber}</span>
                  <strong>{sceneTitle}</strong>
                  <em>{selectedScene.description}</em>
                </figcaption>
              </figure>

              <div className="summary-step-column">
                {explanationSteps.map((step) => (
                  <article className="summary-step-card" key={step.label}>
                    <span>{step.label}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.body}</p>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="summary-dialogue-card summary-explanation-panel" aria-label="이든이 정리한 메모">
                <strong>{encouragementText}</strong>
                <div className="summary-confidence-row" aria-label="자신감 확인">
                  {confidenceBadges.map((badge) => (
                    <span key={badge}>
                      <CheckCircle2 size={16} />
                      {badge}
                    </span>
                  ))}
                </div>
                <p className="summary-reminder">
                  <span>이든</span>
                  {reminderText}
                </p>
              </aside>
            </section>

            <section className="summary-side-column">
              <section className="summary-note-dock" aria-label="생각 저장">
                <div className="summary-note-title">
                  <span>이든 노트</span>
                  <p>오늘의 생각을 하나 골라 저장하면 선생님과 다음 시간에 이어볼 수 있어요.</p>
                </div>
                <h3>내 생각</h3>
                <div className="thought-row summary-thought-row">
                  {thoughts.map((thought) => (
                    <button
                      key={thought.label}
                      className={[thought.label === selectedThought ? 'selected' : '', getThoughtTone(thought.label)].filter(Boolean).join(' ')}
                      type="button"
                      onClick={() => onThought(thought.label)}
                    >
                      <span className="summary-thought-icon">{thought.icon}</span>
                      <span className="summary-thought-copy">
                        <strong>{thought.label}</strong>
                        <small>{thought.hint}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <article className="eden-note-card large summary-eden-note">
                  <strong>{studentExpression} 선택을 기억하고 있어요</strong>
                  <p>{studentChoiceDetail} {motivationText}</p>
                </article>
                <button className="primary-cta" type="button" onClick={onSave}>
                  내 배움 저장하기
                  <CheckCircle2 size={20} />
                </button>
                <p className="summary-note-hint">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {notePrivacyText}
                </p>
              </section>
            </section>
          </section>

          <section className="summary-memory-strip">
            <div className="summary-memory-title">
              <strong>기억에 남는 장면</strong>
              <p>눌러서 장면을 다시 살펴볼 수 있어요.</p>
            </div>
            <div className="summary-memory-rail" aria-label="기억에 남은 장면 선택">
              {job.scenes.map((scene, index) => {
                const itemTitle = scene.label.replace(/^\d+\s*/, '');
                const isSelected = scene.id === selectedScene.id;
                return (
                  <button
                    key={scene.id}
                    className={isSelected ? 'selected' : ''}
                    type="button"
                    aria-current={isSelected ? 'step' : undefined}
                    onClick={() => onScene(scene.id)}
                  >
                    <img src={getSceneImage(job.id, scene.id)} alt="" draggable={false} />
                    <div className="summary-memory-copy">
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{itemTitle}</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </article>
      </section>
    </main>
  );
}

function Saved({
  job,
  selectedSceneId,
  record,
  onBack,
  onOtherJob,
  onRecords,
  onHome
}: {
  job: ReturnType<typeof getJob>;
  selectedSceneId: string;
  record?: ExplorationRecord;
  onBack: () => void;
  onOtherJob: () => void;
  onRecords: () => void;
  onHome: () => void;
}) {
  const sceneImage = record ? getRecordSceneImage(record) : getSceneImage(job.id, selectedSceneId);
  const savedJob = record?.jobTitle ?? job.title;
  const savedScene = record?.memorableScene ?? '오늘의 장면';
  const savedThought = record?.studentThought ?? '더 알아볼래요';
  const savedNote = record?.edenNote ?? '다음 수업에서 다시 이어볼 수 있어요.';
  return (
    <main className="saved-screen">
      <header className="saved-page-head">
        <button className="saved-back-button" type="button" onClick={onBack} aria-label="탐색 정리로 돌아가기">
          <ChevronLeft size={22} />
        </button>
        <div>
          <span className="section-label">{job.title}의 하루</span>
          <h2>저장 완료</h2>
        </div>
      </header>

      <section className="saved-stage">
        <section className="saved-card">
          <CheckCircle2 size={54} />
          <h2>내 배움이 저장되었어요!</h2>
          <p>오늘의 {savedJob} 체험을 성공적으로 정리했어요.</p>
          <div className="saved-card-summary" aria-label="저장된 내용 요약">
            <div>
              <span>기억에 남은 장면</span>
              <strong>{savedScene}</strong>
            </div>
            <div>
              <span>내 생각</span>
              <strong>{savedThought}</strong>
            </div>
            <div>
              <span>이든 노트</span>
              <p>{savedNote}</p>
            </div>
          </div>
          <div className="saved-job-chip">
            <img src={sceneImage} alt="" draggable={false} />
            <div>
              <strong>{savedJob}의 하루 {savedScene}</strong>
              <span>{record ? `${formatDate(record.createdAt)} 저장` : '오늘 저장한 기록'}</span>
              <em>{savedNote}</em>
            </div>
          </div>
        </section>

        <div className="saved-character-stage">
          <img className="saved-stage-eiden" src={jobEidenWelcome[job.id]} alt="저장을 축하하는 이든" draggable={false} />
          <div className="saved-character-sparkles" aria-hidden="true">
            <Sparkles size={18} />
            <Sparkles size={14} />
          </div>
        </div>

        <div className="saved-notebook-stage">
          <img className="saved-stage-notebook" src={appAssets.save.notebook} alt="" draggable={false} />
          <div className="saved-notebook-copy">
            <strong>{savedJob}의 하루</strong>
            <span>{savedThought}</span>
            <p>{savedScene}</p>
          </div>
        </div>
      </section>

      <div className="landing-actions saved-bottom-actions">
        <button className="secondary-cta saved-action-card" type="button" onClick={onRecords}>
          <BookOpen size={26} />
          <span>내 기록 보기</span>
        </button>
        <button className="secondary-cta saved-action-card" type="button" onClick={onOtherJob}>
          <BriefcaseBusiness size={26} />
          <span>다른 직업 보기</span>
        </button>
        <button className="primary-cta saved-action-card" type="button" onClick={onHome}>
          <House size={26} />
          <span>처음으로 돌아가기</span>
        </button>
      </div>
    </main>
  );
}

function Records({
  records,
  onBack,
  onOtherJob,
  onSummary,
  onTeacher
}: {
  records: ExplorationRecord[];
  onBack: () => void;
  onOtherJob: () => void;
  onSummary: () => void;
  onTeacher: () => void;
}) {
  const sortedRecords = sortRecordsByLatest(records);
  const primaryRecord = sortedRecords[0];
  const recordsByJob = new Map<string, ExplorationRecord>();
  for (const record of sortedRecords) {
    if (!recordsByJob.has(record.jobId)) {
      recordsByJob.set(record.jobId, record);
    }
  }
  const primaryJob = primaryRecord ? jobs.find((job) => job.id === primaryRecord.jobId) : undefined;
  const orderedJobs = primaryJob ? [primaryJob, ...jobs.filter((job) => job.id !== primaryJob.id)] : jobs;
  return (
    <main className="records-screen">
      <img className="records-backplate" src={appAssets.records.scrapbook} alt="" draggable={false} />
      <section className="records-head">
        <div>
          <button className="records-back-button" type="button" onClick={onBack} aria-label="저장 완료로 돌아가기">
            <ChevronLeft size={22} />
          </button>
          <span className="section-label">{primaryRecord?.jobTitle ?? '바리스타'}의 하루</span>
          <h2>내 기록</h2>
          <p>살펴본 직업을 다시 보고 이어서 탐색할 수 있어요.</p>
        </div>
        <div className="records-head-actions">
          <button className="secondary-cta compact records-teacher-entry" type="button" onClick={onTeacher}>
            교사용으로 보기
          </button>
          <button className="primary-cta compact" type="button" onClick={onOtherJob}>다른 직업 보기</button>
        </div>
      </section>
      <section className="records-journal">
        <section className="record-list">
          {records.length ? orderedJobs.map((job, index) => {
            const record = recordsByJob.get(job.id);
            return (
              <article key={job.id} className={`record-card ${record ? 'is-saved' : 'is-pending'} ${index === 0 ? 'featured' : ''}`}>
                <img src={record ? getRecordSceneImage(record) : getJobVisual(job.id).diorama} alt="" draggable={false} />
                <span>{record ? (index === 0 ? '최근 기록' : formatDate(record.createdAt)) : '저장한 기록'}</span>
                <h3>{record ? `${job.title}의 하루 ${record.memorableScene}` : `${job.title}의 하루`}</h3>
                <p>{record ? `${formatDate(record.createdAt)}` : '아직 정리 전'}</p>
                <div>{record ? record.edenNote : job.shortDescription}</div>
                <button type="button" onClick={record ? onSummary : onOtherJob}>{record ? '다시 보기' : '다음에 보기'}</button>
              </article>
            );
          }) : (
            <article className="record-card empty">
              <img src={appAssets.records.scrapbook} alt="" draggable={false} />
              <h3>아직 저장한 기록이 없습니다</h3>
              <p>직업 탐색을 마치면 이곳에서 다시 볼 수 있어요.</p>
              <button type="button" onClick={onOtherJob}>직업 소개로 가기</button>
            </article>
          )}
        </section>
        {primaryRecord && (
          <section className="records-note">
            <img src={jobEidenWelcome[primaryRecord.jobId]} alt="" draggable={false} />
            <div>
              <span>이든의 한마디</span>
              <strong>선택한 모습을 다시 볼 수 있어요.</strong>
              <p>{primaryRecord.memorableScene} 장면과 {primaryRecord.studentThought} 마음을 기억했어요. 다음에도 새로운 도전을 함께해요.</p>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function TeacherDashboard({
  logs,
  records,
  drawerLog,
  onOpen,
  onClose,
  onConfirm,
  onStudent,
  onClassEntryReady
}: {
  logs: TeacherLog[];
  records: ExplorationRecord[];
  drawerLog: TeacherLog | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  onConfirm: (id: string, decision: TeacherDecision, note?: string) => void;
  onStudent: () => void;
  onClassEntryReady: (session: ClassEntrySession) => void;
}) {
  const pending = logs.filter((log) => log.status === '확인 대기');
  const completed = logs.filter((log) => log.status === '기록 완료');
  const supportRequests = logs.filter((log) => log.signal === '도움 필요' || log.signal === '쉬기/전환' || log.signal === '모름/불확실');
  const studentCount = new Set(logs.map((log) => log.studentName)).size;
  const orderedLogs = logs.slice().sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const highlightedLog = drawerLog ?? pending[0] ?? orderedLogs[0];
  const [activePage, setActivePage] = useState<TeacherDashboardPageId>('records');
  return (
    <main className="teacher-screen">
      <div className="teacher-layout">
        <aside className="teacher-sidebar" aria-label="교사 대시보드 메뉴">
          <div className="teacher-sidebar-brand">
            <span><Sparkles size={20} /></span>
            <strong>꿈이든</strong>
            <small>진로 탐색</small>
          </div>
          {teacherDashboardNavigation.map(({ id, label, Icon }) => {
            return (
              <button
                key={id}
                className={activePage === id ? 'active' : ''}
                type="button"
                onClick={() => setActivePage(id)}
                aria-current={activePage === id ? 'page' : undefined}
              >
                <Icon size={20} />
                {label}
              </button>
            );
          })}
          {[
            ['지원 요청', HeartHandshake],
            ['최근 탐색', Clock3],
            ['이해 확인', CheckCircle2],
            ['자료실', BriefcaseBusiness]
          ].map(([label, Icon]) => {
            const MenuIcon = Icon as typeof Clock3;
            return (
              <button key={label as string} type="button" onClick={() => setActivePage('records')}>
                <MenuIcon size={20} />
                {label as string}
              </button>
            );
          })}
          <div className="teacher-profile">
            <img src={appAssets.teacher.teacherAvatar} alt="" draggable={false} />
            <strong>선생님</strong>
            <span>담임 교사</span>
          </div>
        </aside>

        <section className="teacher-main">
          <header className="teacher-page-head">
            <div>
              <h2>{activePage === 'students' ? '학생 관리' : '교사용 보기'} <span>{activePage === 'students' ? '등록' : pending.length || 1}</span></h2>
            </div>
            <div className="teacher-page-profile">
              <img src={appAssets.teacher.teacherAvatar} alt="" draggable={false} />
              <strong>선생님</strong>
            </div>
          </header>

          {activePage === 'students' ? (
            <TeacherStudentManagement onClassEntryReady={onClassEntryReady} />
          ) : (
            <>
              <section className="teacher-metric-row" aria-label="기록 상태 요약">
                <article className="metric-card emphasis">
                  <ClipboardList size={28} />
                  <strong>{studentCount || 1}명</strong>
                  <span>오늘 탐색한 학생</span>
                </article>
                <article className="metric-card">
                  <CheckCircle2 size={28} />
                  <strong>{completed.length}건</strong>
                  <span>이해 확인 완료</span>
                </article>
                <article className="metric-card">
                  <HeartHandshake size={28} />
                  <strong>{supportRequests.length}건</strong>
                  <span>지원 요청</span>
                </article>
              </section>

              <section className="teacher-toolbar">
                <div>
                  <h3>학생 탐색 기록</h3>
                  <p>학생들의 탐색 활동과 교사 확인이 필요한 기록을 살펴봅니다.</p>
                </div>
                <div className="teacher-toolbar-actions">
                  <button className="secondary-cta compact" type="button">
                    <CalendarDays size={18} />
                    {formatDate(records[0]?.createdAt ?? logs[0]?.createdAt ?? new Date().toISOString())}
                  </button>
                  <button className="secondary-cta compact" type="button">
                    <Filter size={18} />
                    필터
                  </button>
                  <button className="teacher-student-toggle" type="button" onClick={onStudent}>
                    학생 화면으로
                  </button>
                </div>
              </section>

              <section className={`teacher-content-grid ${drawerLog ? 'drawer-open' : ''}`}>
                <div className="teacher-content-main">
                  <div className="teacher-table-card">
                    <div className="teacher-table-head" aria-hidden="true">
                      <span>학생 이름</span>
                      <span>직업</span>
                      <span>탐색 단계</span>
                      <span>이해 확인</span>
                      <span>탐색 시간</span>
                      <span>기록 시간</span>
                    </div>
                    <div className="table-like teacher-record-list">
                      {orderedLogs.map((log) => {
                        const isOpen = drawerLog?.id === log.id;
                        return (
                          <button
                            key={log.id}
                            className={isOpen ? 'review-row is-open' : 'review-row'}
                            type="button"
                            onClick={() => onOpen(log.id)}
                          >
                            <img src={appAssets.teacher.studentAvatars} alt="" draggable={false} />
                            <strong>{log.studentName}</strong>
                            <span>{log.jobTitle}</span>
                            <span>{log.stageLabel}</span>
                            <em>{log.status === '기록 완료' ? '완료' : log.status === '저장 오류' ? '저장 확인 필요' : '확인 필요'}</em>
                            <span>{formatMinutesAgo(log.createdAt)}</span>
                            <span>{formatDateTime(log.createdAt)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {highlightedLog && !drawerLog && (
                    <section className="teacher-student-card">
                      <img src={getLogVisual(highlightedLog).image} alt="" draggable={false} />
                      <div>
                        <span>{highlightedLog.studentName} · {highlightedLog.jobTitle}</span>
                        <strong>{highlightedLog.stageLabel}</strong>
                        <p>{buildTeacherSessionSummary(highlightedLog).summaryForTeacher}</p>
                        <small>{buildTeacherSessionSummary(highlightedLog).nextInstructionGuide[0]?.action}</small>
                      </div>
                      <div className="teacher-action-stack">
                        <button type="button" onClick={() => onConfirm(highlightedLog.id, 'accepted')}>근거 채택</button>
                        <button type="button" onClick={() => onOpen(highlightedLog.id)}>자세히 보기</button>
                      </div>
                    </section>
                  )}
                </div>

                {drawerLog ? (
                  <TeacherDrawer log={drawerLog} onClose={onClose} onConfirm={onConfirm} />
                ) : (
                  <aside className="teacher-empty-drawer" aria-label="학생 관찰 상세 대기">
                    <strong>학생 기록을 선택해 주세요</strong>
                    <p>오른쪽 상세 패널에서 장면, 표현, 지원 도구를 바로 확인할 수 있어요.</p>
                  </aside>
                )}
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

type RosterDraft = {
  studentCode: string;
  displayName: string;
  classNumber: string;
};

type RosterNotice = {
  kind: 'success' | 'error';
  message: string;
};

const emptyRosterDraft: RosterDraft = {
  studentCode: '',
  displayName: '',
  classNumber: ''
};

function draftFromStudent(student: TeacherRosterStudent): RosterDraft {
  return {
    studentCode: student.studentCode,
    displayName: student.displayName,
    classNumber: student.classNumber ?? ''
  };
}

function classNumberFromDraft(draft: RosterDraft) {
  const trimmed = draft.classNumber.trim();
  return trimmed || null;
}

function studentLabel(student: ClassEntryStudent) {
  return student.displayName || '학생';
}

function buildStudentDraftPayload(draft: RosterDraft) {
  return {
    studentCode: draft.studentCode.trim(),
    displayName: draft.displayName.trim(),
    classNumber: classNumberFromDraft(draft)
  };
}

function ClassStudentEntryModal({
  classLabel,
  students,
  loading,
  startingStudentId,
  message,
  onClose,
  onSelect
}: {
  classLabel: string;
  students: ClassEntryStudent[];
  loading: boolean;
  startingStudentId: string | null;
  message: string | null;
  onClose: () => void;
  onSelect: (student: ClassEntryStudent) => void;
}) {
  const firstStudentButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(!startingStudentId);

  onCloseRef.current = onClose;
  canCloseRef.current = !startingStudentId;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstStudentButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && canCloseRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []
      ).filter((element) => !element.hasAttribute('disabled'));

      if (!focusable.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div className="class-entry-backdrop">
      <section ref={modalRef} className="class-entry-modal" role="dialog" aria-modal="true" aria-labelledby="class-entry-title">
        <header>
          <div>
            <span>{classLabel}</span>
            <h3 id="class-entry-title">본인 이름을 선택해요</h3>
            <p>선택하면 바로 직업 체험 화면으로 이동합니다.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="클래스 입장 닫기" disabled={Boolean(startingStudentId)}>
            <X size={20} />
          </button>
        </header>

        {loading ? (
          <div className="class-entry-alert is-loading" role="status">
            <RefreshCw size={20} />
            <span>학생 이름을 불러오는 중입니다.</span>
          </div>
        ) : students.length ? (
          <div className="class-entry-student-grid" aria-label="학생 이름 선택">
            {students.map((student, index) => {
              const starting = startingStudentId === student.id;
              return (
                <button
                  key={student.id}
                  ref={index === 0 ? firstStudentButtonRef : undefined}
                  type="button"
                  onClick={() => onSelect(student)}
                  disabled={Boolean(startingStudentId)}
                >
                  <UserCheck size={22} />
                  <strong>{studentLabel(student)}</strong>
                  <span>{student.classNumber ? `${student.classNumber}번` : '학생'}</span>
                  {starting && <em>시작 중</em>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="class-entry-alert" role="status">
            <AlertTriangle size={20} />
            <span>선택할 학생 이름이 없습니다.</span>
          </div>
        )}

        {message && !loading && (
          <div className="class-entry-alert" role="alert">
            <AlertTriangle size={20} />
            <span>{message}</span>
          </div>
        )}
      </section>
    </div>
  );
}

function TeacherStudentManagement({
  onClassEntryReady
}: {
  onClassEntryReady: (session: ClassEntrySession) => void;
}) {
  const [teacher, setTeacher] = useState<TeacherSession | null>(null);
  const [classes, setClasses] = useState<TeacherClassSummary[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<TeacherRosterStudent[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RosterDraft>>({});
  const [newStudent, setNewStudent] = useState<RosterDraft>(emptyRosterDraft);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notice, setNotice] = useState<RosterNotice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [classEntryStarting, setClassEntryStarting] = useState(false);

  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const rosterWritable = canManageRoster(teacher?.role);
  const activeStudents = students.filter((student) => student.active);

  function updateDrafts(nextStudents: TeacherRosterStudent[]) {
    setDrafts(Object.fromEntries(nextStudents.map((student) => [student.id, draftFromStudent(student)])));
  }

  async function refreshStudents(classId = selectedClassId) {
    if (!classId) {
      setStudents([]);
      setDrafts({});
      return;
    }

    const nextStudents = await fetchClassStudents(classId);
    setStudents(nextStudents);
    updateDrafts(nextStudents);
  }

  async function loadRosterPage() {
    setStatus('loading');
    setLoadError(null);
    setNotice(null);
    try {
      const [nextTeacher, nextClasses] = await Promise.all([fetchTeacherMe(), fetchTeacherClasses()]);
      const activeClasses = nextClasses.filter((item) => item.active !== false);
      const nextClassId = activeClasses[0]?.id ?? nextClasses[0]?.id ?? '';
      setTeacher(nextTeacher);
      setClasses(activeClasses.length ? activeClasses : nextClasses);
      setSelectedClassId(nextClassId);
      if (nextClassId) {
        const nextStudents = await fetchClassStudents(nextClassId);
        setStudents(nextStudents);
        updateDrafts(nextStudents);
      } else {
        setStudents([]);
        setDrafts({});
      }
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setLoadError(getRosterErrorMessage(error));
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        await loadRosterPage();
      } catch {
        if (active) setStatus('error');
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleClassChange(classId: string) {
    setSelectedClassId(classId);
    setNotice(null);
    setStatus('loading');
    try {
      await refreshStudents(classId);
      setStatus('ready');
    } catch (error) {
      setStatus('error');
      setLoadError(getRosterErrorMessage(error));
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClassId || !rosterWritable) return;

    setSavingKey('new');
    setNotice(null);
    try {
      await createRosterStudent(selectedClassId, buildStudentDraftPayload(newStudent));
      setNewStudent(emptyRosterDraft);
      await refreshStudents(selectedClassId);
      setNotice({ kind: 'success', message: '학생을 등록했습니다.' });
    } catch (error) {
      setNotice({ kind: 'error', message: getRosterErrorMessage(error) });
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSave(student: TeacherRosterStudent) {
    if (!rosterWritable) return;

    const draft = drafts[student.id] ?? draftFromStudent(student);
    setSavingKey(`save-${student.id}`);
    setNotice(null);
    try {
      const updated = await updateRosterStudent(student.id, buildStudentDraftPayload(draft));
      setStudents((current) => current.map((item) => (item.id === student.id ? updated : item)));
      setDrafts((current) => ({ ...current, [student.id]: draftFromStudent(updated) }));
      setNotice({ kind: 'success', message: `${studentLabel(updated)} 정보를 저장했습니다.` });
    } catch (error) {
      setNotice({ kind: 'error', message: getRosterErrorMessage(error) });
    } finally {
      setSavingKey(null);
    }
  }

  async function handleToggleActive(student: TeacherRosterStudent) {
    if (!rosterWritable) return;

    setSavingKey(`active-${student.id}`);
    setNotice(null);
    try {
      const updated = await updateRosterStudent(student.id, { active: !student.active });
      setStudents((current) => current.map((item) => (item.id === student.id ? updated : item)));
      setDrafts((current) => ({ ...current, [student.id]: draftFromStudent(updated) }));
      setNotice({ kind: 'success', message: `${studentLabel(updated)} 상태를 변경했습니다.` });
    } catch (error) {
      setNotice({ kind: 'error', message: getRosterErrorMessage(error) });
    } finally {
      setSavingKey(null);
    }
  }

  async function handleClassEntryStart() {
    if (!selectedClass || !rosterWritable || activeStudents.length === 0) return;

    setClassEntryStarting(true);
    setNotice(null);
    try {
      const entrySession = await startTeacherClassEntrySession(selectedClass.id);
      setClassEntryStarting(false);
      onClassEntryReady({
        entryToken: entrySession.entryToken,
        classLabel: entrySession.class.name,
        students: entrySession.students
      });
    } catch (error) {
      setNotice({ kind: 'error', message: getRosterErrorMessage(error) });
      setClassEntryStarting(false);
    }
  }

  return (
    <section className="teacher-student-management" aria-label="학생 관리">
      <header className="student-management-head">
        <div>
          <span>교사 roster</span>
          <h3>담당 반 학생을 등록하고 수업 입장을 준비합니다</h3>
        </div>
        <div className="student-management-head-actions">
          <button
            className="primary-cta compact"
            type="button"
            onClick={handleClassEntryStart}
            disabled={!rosterWritable || status !== 'ready' || activeStudents.length === 0 || classEntryStarting}
          >
            <UserCheck size={18} />
            {classEntryStarting ? '입장 준비 중' : '클래스 입장 시작'}
          </button>
          <button className="secondary-cta compact" type="button" onClick={loadRosterPage}>
            <RefreshCw size={18} />
            새로고침
          </button>
        </div>
      </header>

      <div className="student-management-controls">
        <label>
          <span>반 선택</span>
          <select
            value={selectedClassId}
            onChange={(event) => handleClassChange(event.target.value)}
            disabled={status === 'loading' || classes.length === 0}
            aria-label="학생 관리 반 선택"
          >
            {classes.length === 0 ? (
              <option value="">담당 반 없음</option>
            ) : (
              classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {[item.name, item.gradeLabel, item.schoolYear].filter(Boolean).join(' · ')}
                </option>
              ))
            )}
          </select>
        </label>
        <div className="student-management-class-meta">
          <strong>{selectedClass?.name ?? '반을 선택해 주세요'}</strong>
          <span>{teacher ? `${teacher.displayName} · ${teacher.role === 'support_staff' ? '지원 인력' : '교사'}` : '교사 정보를 불러오는 중'}</span>
        </div>
      </div>

      {status === 'error' && (
        <div className="student-management-alert is-error" role="alert">
          <AlertTriangle size={20} />
          <span>{loadError}</span>
          <button type="button" onClick={loadRosterPage}>다시 시도</button>
        </div>
      )}

      {teacher && !rosterWritable && (
        <div className="student-management-alert is-readonly">
          <ShieldAlert size={20} />
          <span>지원 인력은 담당 학생 정보를 볼 수만 있습니다. 등록, 수정, 수업 입장 준비는 담당 교사나 관리자에게 요청해 주세요.</span>
        </div>
      )}

      {notice && (
        <div className={`student-management-alert ${notice.kind === 'error' ? 'is-error' : 'is-success'}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
          {notice.kind === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
          <span>{notice.message}</span>
        </div>
      )}

      {rosterWritable && (
        <form className="student-create-form" onSubmit={handleCreate}>
          <label>
            <span>학생 코드</span>
            <input
              value={newStudent.studentCode}
              onChange={(event) => setNewStudent((current) => ({ ...current, studentCode: event.target.value }))}
              placeholder="예: S-102"
              required
            />
          </label>
          <label>
            <span>이름</span>
            <input
              value={newStudent.displayName}
              onChange={(event) => setNewStudent((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="학생 이름"
              required
            />
          </label>
          <label>
            <span>번호</span>
            <input
              value={newStudent.classNumber}
              onChange={(event) => setNewStudent((current) => ({ ...current, classNumber: event.target.value }))}
              inputMode="numeric"
              placeholder="선택"
            />
          </label>
          <button type="submit" disabled={savingKey === 'new' || !selectedClassId}>
            <UserPlus size={18} />
            {savingKey === 'new' ? '등록 중' : '학생 등록'}
          </button>
        </form>
      )}

      <div className="student-roster-list" aria-busy={status === 'loading'}>
        {status === 'loading' && <p className="student-roster-empty">학생 정보를 불러오는 중입니다.</p>}
        {status !== 'loading' && students.length === 0 && (
          <p className="student-roster-empty">아직 등록된 학생이 없습니다.</p>
        )}
        {status !== 'loading' && students.map((student) => {
          const draft = drafts[student.id] ?? draftFromStudent(student);
          const saving = savingKey?.endsWith(student.id) ?? false;
          return (
            <article key={student.id} className={student.active ? 'student-roster-row' : 'student-roster-row is-inactive'}>
              <div className="student-roster-status">
                <Users size={20} />
                <div>
                  <strong>{studentLabel(student)}</strong>
                  <span>{student.active ? '활성 학생' : '비활성 학생'}</span>
                </div>
              </div>

              <div className="student-roster-fields">
                <label>
                  <span>코드</span>
                  <input
                    value={draft.studentCode}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [student.id]: { ...draft, studentCode: event.target.value }
                    }))}
                    disabled={!rosterWritable}
                  />
                </label>
                <label>
                  <span>이름</span>
                  <input
                    value={draft.displayName}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [student.id]: { ...draft, displayName: event.target.value }
                    }))}
                    disabled={!rosterWritable}
                  />
                </label>
                <label>
                  <span>번호</span>
                  <input
                    value={draft.classNumber}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [student.id]: { ...draft, classNumber: event.target.value }
                    }))}
                    disabled={!rosterWritable}
                    inputMode="numeric"
                  />
                </label>
              </div>

              <div className="student-roster-actions" aria-label={`${studentLabel(student)} 관리`}>
                {rosterWritable ? (
                  <>
                    <button type="button" onClick={() => handleSave(student)} disabled={saving}>
                      <Save size={18} />
                      저장
                    </button>
                    <button type="button" onClick={() => handleToggleActive(student)} disabled={saving}>
                      <Power size={18} />
                      {student.active ? '비활성화' : '다시 활성화'}
                    </button>
                  </>
                ) : (
                  <span className="student-roster-readonly">읽기 전용</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function jobIdForTitle(title: string): JobId {
  return jobs.find((job) => job.title === title)?.id ?? 'barista-aide';
}

function Panel({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <article className="dashboard-panel">
      <header>
        <h3>{title}</h3>
        {typeof count === 'number' && <span>{count}</span>}
      </header>
      {children}
    </article>
  );
}

function TeacherDrawer({
  log,
  onClose,
  onConfirm
}: {
  log: TeacherLog;
  onClose: () => void;
  onConfirm: (id: string, decision: TeacherDecision, note?: string) => void;
}) {
  const visual = getLogVisual(log);
  const sessionSummary = buildTeacherSessionSummary(log);
  const [teacherNote, setTeacherNote] = useState('');
  const lastDecision = log.decisionHistory?.[log.decisionHistory.length - 1];
  const hasPersistenceError = lastDecision?.persistedVia === 'failed';
  return (
    <aside className="teacher-drawer" aria-label="학생 관찰 상세">
      <button className="icon-button" type="button" onClick={onClose} aria-label="상세 닫기">
        <X size={18} />
      </button>
      <div className="teacher-drawer-heading">
        <h3>{log.studentName}의 탐색 기록</h3>
        <div className="teacher-drawer-meta">
          <span>탐색일시 {formatDateTime(log.createdAt)}</span>
          <span>탐색시간 {formatMinutesAgo(log.createdAt)}</span>
        </div>
      </div>

      <div className={`teacher-persistence-banner ${hasPersistenceError ? 'is-error' : ''}`} role={hasPersistenceError ? 'alert' : 'status'}>
        <strong>{getTeacherPersistenceLabel(log)}</strong>
        <span>
          {hasPersistenceError
            ? '교사 조치는 보존되어 있으며 다시 저장할 수 있습니다.'
            : log.status === '기록 완료'
              ? '교사 확인이 저장되었습니다.'
              : '교사 확인 전 후보 기록입니다.'}
        </span>
      </div>

      <section className="drawer-scene-panel">
        <strong>탐색한 직업</strong>
        <div className="drawer-scene-card">
          <img src={visual.image} alt={`${visual.job.title} ${visual.scene.label} 장면`} draggable={false} />
          <span>{visual.job.title}</span>
        </div>
      </section>

      <section className="drawer-expression-panel">
        <strong>학생이 선택한 표현</strong>
        <div className="drawer-expression-chip">
          <CheckCircle2 size={22} />
          <span>{getTeacherExpression(log)}</span>
        </div>
      </section>

      <article className="drawer-note">
        <strong>교사용 세션 요약</strong>
        <div className="drawer-note-body">
          <img src={appAssets.characters.wave} alt="" draggable={false} />
          <p>{sessionSummary.summaryForTeacher}</p>
        </div>
      </article>

      <section className="drawer-review-section">
        <div className="drawer-section-title">
          <strong>장면 근거</strong>
          <span>교사 확인 전 후보</span>
        </div>
        {sessionSummary.sceneEvidence.map((candidate) => (
          <article key={candidate.criterionKey} className="drawer-evidence-card">
            <div>
              <strong>{candidate.title}</strong>
              <span>{candidate.candidateLevelLabel} · {candidate.candidateStatusLabel}</span>
            </div>
            <p>{candidate.summary}</p>
            <small>{candidate.teacherReviewQuestion}</small>
          </article>
        ))}
      </section>

      <section className="drawer-review-section">
        <div className="drawer-section-title">
          <strong>지원 사용</strong>
          <span>{sessionSummary.sceneTurnReached}</span>
        </div>
        <div className="drawer-support-summary">
          <HeartHandshake size={20} />
          <span>{sessionSummary.supportUsage}</span>
          <small>{sessionSummary.responseMode}</small>
        </div>
      </section>

      <section className="drawer-review-section">
        <div className="drawer-section-title">
          <strong>다음 수업 안내</strong>
          <span>교사가 선택</span>
        </div>
        <ol className="drawer-next-guide">
          {sessionSummary.nextInstructionGuide.map((guide, index) => (
            <li key={guide.id}>
              <span>{index + 1}</span>
              <div>
                <strong>{guide.action}</strong>
                <p>{guide.reason}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="drawer-review-section">
        <div className="drawer-section-title">
          <strong>필요한 교사 조치</strong>
          <span>{sessionSummary.teacherDecisionRequired.length}개</span>
        </div>
        <ul className="drawer-required-list">
          {sessionSummary.teacherDecisionRequired.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <dl>
        <div><dt>직업</dt><dd>{log.jobTitle}</dd></div>
        <div><dt>활동 단계</dt><dd>{log.stageLabel}</dd></div>
        <div><dt>관찰 신호</dt><dd>{log.signal}</dd></div>
        <div><dt>확인 상태</dt><dd>{log.status}</dd></div>
      </dl>

      <label className="teacher-note-field">
        <span>교사 메모</span>
        <textarea
          value={teacherNote}
          onChange={(event) => setTeacherNote(event.target.value)}
          rows={3}
          placeholder="다음 수업에서 사용할 지원 방법을 적어 둡니다."
        />
      </label>

      <div className="drawer-actions">
        {teacherDecisionOptions.map((option) => (
          <button key={option.decision} type="button" onClick={() => onConfirm(log.id, option.decision, teacherNote)}>
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function VisualSupportModal({
  jobTitle,
  scene,
  sceneImage,
  onClose
}: {
  jobTitle: string;
  scene: ReturnType<typeof getJob>['scenes'][number];
  sceneImage: string;
  onClose: () => void;
}) {
  const sceneTitle = scene.label.replace(/^\d+\s*/, '');
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const modal = closeButtonRef.current?.closest('.visual-modal');
      const focusable = Array.from(
        modal?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []
      ).filter((element) => !element.hasAttribute('disabled'));

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="visual-modal" role="dialog" aria-modal="true" aria-label="그림으로 보기">
        <button ref={closeButtonRef} className="icon-button" type="button" onClick={onClose} aria-label="그림 보기 닫기">
          <X size={18} />
        </button>
        <span className="section-label">그림으로 보기</span>
        <h3>{jobTitle} · {scene.label}</h3>
        <img className="support-visual-image" src={sceneImage} alt={`${sceneTitle} 장면을 그림으로 살펴보기`} draggable={false} />
        <div className="visual-card-set">
          <article><Coffee size={34} /><strong>도구 보기</strong><span>먼저 사용하는 물건을 봅니다.</span></article>
          <article><Play size={34} /><strong>한 장면씩</strong><span>작은 단계로 다시 봅니다.</span></article>
          <article><Headphones size={34} /><strong>작업 설명</strong><span>장면 설명을 천천히 들어요.</span></article>
        </div>
      </section>
    </div>
  );
}

export function hasBannedCopy(text: string) {
  return bannedCopy.some((item) => text.includes(item));
}
