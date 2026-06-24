import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiClientError,
  canManageRoster,
  completeExplorationSession,
  createExplorationSession,
  createExplorationSessionRecord,
  createExplorationSessionResponse,
  createRecord,
  createRosterStudent,
  createTeacherClass,
  fetchClassStudents,
  fetchClassEntrySession,
  fetchTeacherClasses,
  fetchTeacherMe,
  generateStudentLaunchCode,
  getRosterErrorMessage,
  getStudentLaunchErrorMessage,
  mockCoachGateway,
  persistTeacherDecision,
  resolveStudentLaunch,
  startClassEntryStudent,
  startTeacherClassEntrySession,
  updateRosterStudent
} from './adapters';
import {
  applyResolvedStudentContext,
  applyStartedStudentSession,
  buildClassEntryUrl,
  buildStudentEntryUrl,
  buildTeacherLearningCards,
  buildTeacherSessionSummary,
  getAppHistoryView,
  getClassEntrySessionFromLocalRosterSnapshot,
  getClassEntryPickerStudents,
  getClassEntryTokenFromSearch,
  getIntroContent,
  getNextIntroJobId,
  getPersistedClassEntrySession,
  getPersistedLocalClassEntrySession,
  getSummaryEncouragement,
  getSummaryMotivation,
  getSummaryStudentExpression,
  getStudentLaunchPrefillFromSearch,
  hasBannedCopy,
  mergePersistedStateForInitialLoad,
  avatarSpeechContext,
  teacherDashboardNavigation
} from './App';
import { getSceneImage } from './assets';
import { requestAvatarSpeech } from './avatarVoiceClient';
import { getJob, getSceneAacOptions, getSceneNarration, getSceneObservationPrompt, initialState, jobs } from './data';
import type { AppState, ExplorationRecord, LocalRosterSnapshot, TeacherDecision, TeacherLog } from './domain';
import { validateStudentSceneTurnOutput } from './aiPromptContracts';
import {
  createGuardedSceneReply,
  getCappedSceneTurnCount,
  getGuardedStudentSceneTurn,
  getSceneTurnIndex
} from './guardedSceneTurns';
import { applyTeacherDecisionToLog, confirmTeacherLogDecision } from './teacherDecision';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createAiSuggestionTeacherLog(overrides: Partial<TeacherLog> = {}): TeacherLog {
  return {
    id: 'teacher-log-1',
    createdAt: '2026-06-22T00:00:00.000Z',
    sessionId: 'session-1',
    studentId: 'student-1',
    studentName: '홍길동 학생',
    jobTitle: '바리스타',
    stageLabel: '준비',
    signal: '직업 이해',
    supportLevel: 'AAC 지원',
    summary: '학생이 컵 AAC를 선택했습니다.',
    aiSuggestionId: 'suggestion-1',
    status: '확인 대기',
    ...overrides
  };
}

describe('student exploration copy and records', () => {
  it('starts a fresh browser visit at landing even when saved state was mid-flow', () => {
    const restored = mergePersistedStateForInitialLoad({
      ...initialState,
      view: 'day',
      selectedJobId: 'baker-aide',
      studentSession: {
        mode: 'demo',
        startedAt: '2026-06-22T00:00:00.000Z'
      },
      teacherEvidenceTarget: {
        sessionId: 'old-session',
        studentId: 'old-student'
      },
      visualSupportOpen: true,
      resting: true,
      replaying: true
    });

    expect(restored.view).toBe('landing');
    expect(restored.selectedJobId).toBe('baker-aide');
    expect(restored.studentSession).toBeUndefined();
    expect(restored.teacherEvidenceTarget).toBeUndefined();
    expect(restored.visualSupportOpen).toBe(false);
    expect(restored.resting).toBe(false);
    expect(restored.replaying).toBe(false);
  });

  it('does not allow browser TTS fallback for demo/local avatar speech', () => {
    const context = avatarSpeechContext({
      ...initialState,
      studentSession: {
        mode: 'demo',
        startedAt: '2026-06-22T00:00:00.000Z',
        classId: 'local-1',
        studentId: 'local-student-1',
        displayName: '홍길동'
      },
      teacherEvidenceTarget: {
        studentId: 'local-student-1',
        sessionId: 'local-session-local-student-1'
      }
    });

    expect(context).toEqual({
      sessionId: 'local-session-local-student-1',
      allowBrowserFallback: false
    });
  });

  it('keeps API avatar speech provider-only with the student token', () => {
    const context = avatarSpeechContext({
      ...initialState,
      studentSession: {
        mode: 'api',
        classId: 'class-1',
        studentId: 'student-1',
        studentToken: 'student-token-1',
        sessionId: 'session-1',
        startedAt: '2026-06-22T00:00:00.000Z'
      }
    });

    expect(context).toEqual({
      sessionId: 'session-1',
      studentToken: 'student-token-1',
      allowBrowserFallback: false
    });
  });

  it('restores a local class-entry roster after the teacher page reloads', () => {
    const restored = getPersistedLocalClassEntrySession({
      ...initialState,
      localClassEntrySession: {
        local: true,
        classLabel: '1반',
        students: [
          {
            id: 'local-student-1',
            classId: 'local-1',
            studentCode: 'AUTO-HONG',
            displayName: '홍길동',
            classNumber: '1'
          }
        ]
      }
    } as Partial<AppState> & {
      localClassEntrySession: {
        local: true;
        classLabel: string;
        students: Array<{
          id: string;
          classId: string;
          studentCode: string;
          displayName: string;
          classNumber: string;
        }>;
      };
    });

    expect(restored).toMatchObject({
      local: true,
      classLabel: '1반',
      students: [{ displayName: '홍길동', classNumber: '1' }]
    });
  });

  it('recovers class-entry names from the persisted local roster when the API is unavailable', () => {
    const snapshot: LocalRosterSnapshot = {
      classes: [{ id: 'local-1', name: '1반', schoolYear: 2026, active: true }],
      selectedClassId: 'local-1',
      studentsByClassId: {
        'local-1': [
          {
            id: 'local-student-1',
            classId: 'local-1',
            studentCode: 'AUTO-HONG',
            displayName: '홍길동',
            classNumber: '1'
          }
        ]
      },
      updatedAt: '2026-06-23T13:20:00.000Z'
    };

    expect(getClassEntrySessionFromLocalRosterSnapshot(snapshot)).toMatchObject({
      local: true,
      classLabel: '1반',
      students: [{ displayName: '홍길동', classNumber: '1' }]
    });
  });

  it('initializes class-entry state from a local roster snapshot when the app session is missing it', () => {
    const snapshot: LocalRosterSnapshot = {
      classes: [{ id: 'local-1', name: '1반', schoolYear: 2026, active: true }],
      selectedClassId: 'local-1',
      studentsByClassId: {
        'local-1': [
          {
            id: 'local-student-1',
            classId: 'local-1',
            studentCode: 'AUTO-HONG',
            displayName: '홍길동',
            classNumber: '1'
          }
        ]
      },
      updatedAt: '2026-06-23T13:20:00.000Z'
    };

    const restoredState = mergePersistedStateForInitialLoad({ ...initialState }, null, snapshot);

    expect(restoredState.localClassEntrySession).toMatchObject({
      local: true,
      classLabel: '1반',
      students: [{ displayName: '홍길동', classNumber: '1' }]
    });
    expect(getPersistedClassEntrySession({ ...initialState }, snapshot)).toMatchObject({
      local: true,
      classLabel: '1반',
      students: [{ displayName: '홍길동', classNumber: '1' }]
    });
  });

  it('keeps the class-entry picker ordered and searchable for full class rosters', () => {
    const students = Array.from({ length: 30 }, (_, index) => {
      const classNumber = String(30 - index);
      return {
        id: `student-${classNumber}`,
        classId: 'class-1',
        displayName: `학생 ${classNumber}`,
        classNumber
      };
    });

    const ordered = getClassEntryPickerStudents(students);
    const filteredByNumber = getClassEntryPickerStudents(students, '학생 7');
    const filteredByName = getClassEntryPickerStudents(students, '학생 12');

    expect(ordered).toHaveLength(30);
    expect(ordered.slice(0, 3).map((student) => student.classNumber)).toEqual(['1', '2', '3']);
    expect(filteredByNumber.map((student) => student.classNumber)).toEqual(['7']);
    expect(filteredByName).toMatchObject([{ displayName: '학생 12', classNumber: '12' }]);
  });

  it('removes only explicit legacy seeded teacher logs from previous browser state', () => {
    const realLog = createAiSuggestionTeacherLog({
      id: 'teacher-log-real',
      sessionId: 'session-real',
      studentId: 'student-real',
      studentName: '김민준 학생'
    });
    const restored = mergePersistedStateForInitialLoad({
      ...initialState,
      teacherLogs: [
        createAiSuggestionTeacherLog({
          id: 'log-demo-legacy',
          sessionId: 'demo-session-barista-prep',
          studentId: 'demo-student-hong',
          studentName: '홍길동 학생'
        }),
        createAiSuggestionTeacherLog({
          id: 'aac-local-real',
          sessionId: 'local-session-local-student-1',
          studentId: 'local-student-1',
          studentName: '홍길동'
        }),
        realLog
      ]
    });

    expect(initialState.teacherLogs).toEqual([]);
    expect(restored.teacherLogs.map((log) => log.id)).toEqual(['aac-local-real', 'teacher-log-real']);
  });

  it('keeps local student exploration records while removing explicit legacy seed records', () => {
    const job = getJob('barista-aide');
    const localRecord = createRecord(
      {
        ...initialState,
        selectedJobId: 'barista-aide',
        selectedSceneId: 'prep',
        studentSession: {
          mode: 'demo',
          startedAt: '2026-06-23T13:20:00.000Z',
          classId: 'local-1',
          studentId: 'local-student-1',
          displayName: '홍길동',
          classNumber: '1'
        }
      },
      job
    );
    const legacyRecord: ExplorationRecord = {
      ...localRecord,
      id: 'record-demo-legacy',
      studentName: '홍길동 학생'
    };
    const realRecord: ExplorationRecord = {
      ...localRecord,
      id: 'record-real',
      studentName: '김민준 학생',
      logs: [
        createAiSuggestionTeacherLog({
          id: 'teacher-log-real-record',
          sessionId: 'session-real-record',
          studentId: 'student-real-record',
          studentName: '김민준 학생'
        })
      ]
    };
    const restored = mergePersistedStateForInitialLoad({
      ...initialState,
      records: [legacyRecord, localRecord, realRecord]
    });

    expect(restored.records.map((record) => record.id).sort()).toEqual([localRecord.id, 'record-real'].sort());
    expect(restored.records.find((record) => record.id === localRecord.id)?.studentName).toBe('홍길동');
  });

  it('starts at landing even when an old student entry link is present', () => {
    const prefill = getStudentLaunchPrefillFromSearch('?entry=student&classId=class-1&studentCode=S001');
    const restored = mergePersistedStateForInitialLoad({
      ...initialState,
      view: 'day',
      studentSession: {
        mode: 'demo',
        startedAt: '2026-06-22T00:00:00.000Z'
      }
    }, prefill);

    expect(prefill).toEqual({ classId: 'class-1', studentCode: 'S001' });
    expect(restored.view).toBe('landing');
    expect(restored.studentSession).toBeUndefined();
  });

  it('accepts only known app views from browser history state', () => {
    expect(getAppHistoryView({ kkumideunView: 'launch' })).toBe('launch');
    expect(getAppHistoryView({ kkumideunView: 'intro' })).toBe('intro');
    expect(getAppHistoryView({ kkumideunView: 'path' })).toBeNull();
    expect(getAppHistoryView(null)).toBeNull();
  });

  it('builds student entry links without putting the launch code in the URL', () => {
    const url = buildStudentEntryUrl('https://school.example', '/app', {
      classId: 'class 1',
      studentCode: 'S001'
    });

    expect(url).toBe('https://school.example/app?entry=student&classId=class+1&studentCode=S001');
    expect(url).not.toContain('launchCode');
    expect(getStudentLaunchPrefillFromSearch(new URL(url).search)).toEqual({
      classId: 'class 1',
      studentCode: 'S001'
    });
  });

  it('builds class-entry links without colliding with old student entry prefill links', () => {
    const url = buildClassEntryUrl('https://school.example', '/app', 'entry-token-1');

    expect(url).toBe('https://school.example/app?classEntry=entry-token-1');
    expect(getClassEntryTokenFromSearch(new URL(url).search)).toBe('entry-token-1');
    expect(getStudentLaunchPrefillFromSearch(new URL(url).search)).toBeNull();
    expect(getClassEntryTokenFromSearch('?entry=student&classId=class-1&studentCode=S001')).toBeNull();
  });

  it('flags teacher-dashboard ranking or scoring copy as banned', () => {
    expect(hasBannedCopy('학생 점수와 적합률을 보여줍니다')).toBe(true);
    expect(hasBannedCopy('정답을 잘했어요')).toBe(true);
    expect(hasBannedCopy('학생의 표현을 다음 수업 지원으로 연결합니다')).toBe(false);
  });

  it('creates a student-facing exploration record from the selected scene', () => {
    const job = getJob('library-aide');
    const record = createRecord(
      {
        ...initialState,
        selectedJobId: 'library-aide',
        selectedSceneId: 'guide',
        selectedThought: '더 알아볼래요'
      },
      job
    );

    expect(record.jobTitle).toBe('도서관 사서');
    expect(record.memorableScene).toBe('이용 안내');
    expect(record.studentThought).toBe('더 알아볼래요');
    expect(record.edenNote).toContain('다음 수업');
  });

  it('keeps the selected job when entering intro directly', () => {
    const selectedJob = getJob('library-aide');
    const intro = getIntroContent(selectedJob);
    const stateAfterLandingStart = {
      ...initialState,
      selectedJobId: selectedJob.id,
      view: 'intro' as const
    };

    expect(stateAfterLandingStart.selectedJobId).toBe('library-aide');
    expect(intro.message).toBe('도서관 사서가 일하는 장면을 하나씩 볼게요.');
    expect(intro.nextView).toBe('day');
  });

  it('cycles to the next job inside the intro page', () => {
    expect(getNextIntroJobId('barista-aide')).toBe('library-aide');
    expect(getNextIntroJobId('library-aide')).toBe('baker-aide');
    expect(getNextIntroJobId('baker-aide')).toBe('barista-aide');
  });

  it('uses generated v2 Eiden scene images for every job step', () => {
    for (const job of jobs) {
      for (const scene of job.scenes) {
        const image = getSceneImage(job.id, scene.id);

        expect(image).toContain('/assets/generated/scenes/v2/');
        expect(image).toMatch(/-eiden-v2\.png$/);
      }
    }
  });

  it('keeps scene narration focused on the work scene rather than Eiden', () => {
    const scene = getJob('barista-aide').scenes[0];

    expect(getSceneNarration(scene)).toContain('바리스타');
    expect(getSceneNarration(scene)).not.toContain('이든');
    expect(getSceneNarration(scene)).not.toBe(scene.prompt);
    expect(getSceneNarration(scene)).not.toContain('?');
    expect(getSceneNarration(scene)).not.toContain('무엇일까요');
    expect(hasBannedCopy(getSceneNarration(scene))).toBe(false);
  });

  it('offers AAC choices as participation rather than scoring answers', () => {
    const scene = getJob('barista-aide').scenes[0];
    const options = getSceneAacOptions(scene);

    expect(getSceneObservationPrompt(scene)).toContain('버튼');
    expect(options.map((option) => option.label)).toEqual(['컵', '도구', '준비해요']);
    expect(options.every((option) => option.type !== 'support')).toBe(true);
    expect(options.every((option) => !hasBannedCopy(`${option.label} ${option.value}`))).toBe(true);
  });

  it('creates respectful guarded Eiden follow-up copy from AAC participation', () => {
    const scene = getJob('library-aide').scenes[1];
    const option = getSceneAacOptions(scene).find((item) => item.id === 'bookshelf');

    expect(option).toBeDefined();
    if (!option) throw new Error('Expected bookshelf AAC option for the library sorting scene.');
    const reply = createGuardedSceneReply({
      jobId: 'library-aide',
      scene,
      option,
      sceneTurnCount: 0
    });

    expect(reply).toContain('표현했습니다');
    expect(reply).toContain('책을 제자리에 놓아요');
    expect(reply).toContain('습니다');
    expect(reply).not.toContain('정답');
    expect(reply).not.toContain('틀렸');
    expect(hasBannedCopy(reply)).toBe(false);
  });

  it('renders validated guarded scene turns with replay text, display text, questions, and AAC choices', () => {
    const scene = getJob('barista-aide').scenes[0];
    const turn = getGuardedStudentSceneTurn('barista-aide', scene, 0);

    expect(validateStudentSceneTurnOutput(turn)).toMatchObject({ ok: true });
    expect(turn).toMatchObject({
      version: 'ai-mastery-scene-turn/v1',
      jobId: 'barista-aide',
      sceneId: 'prep',
      turnIndex: 1,
      turnPurpose: 'observe',
      displayText: '먼저 보이는 것을 골라요.',
      studentQuestion: '그림에서 보이는 준비 물건을 하나 골라볼까요?'
    });
    expect(turn.voiceScript).toContain('컵과 도구');
    expect(turn.aacOptions.map((option) => option.id)).toEqual(['cups', 'tools']);
    expect(turn.nextTurnPolicy.fallbackIfNoResponse).toContain('컵과 도구 사진');
    expect(hasBannedCopy(`${turn.voiceScript} ${turn.displayText} ${turn.studentQuestion}`)).toBe(false);
  });

  it('keeps the current student scene loop capped at three turns', () => {
    expect(getSceneTurnIndex(0)).toBe(1);
    expect(getSceneTurnIndex(1)).toBe(2);
    expect(getSceneTurnIndex(2)).toBe(3);
    expect(getSceneTurnIndex(3)).toBe(3);
    expect(getCappedSceneTurnCount(4)).toBe(3);
  });

  it('treats AAC and touch choice as the same guarded response path', () => {
    const scene = getJob('barista-aide').scenes[0];
    const option = getSceneAacOptions(scene).find((item) => item.id === 'cups');

    expect(option).toBeDefined();
    if (!option) throw new Error('Expected cups AAC option for the barista prep scene.');
    const reply = createGuardedSceneReply({
      jobId: 'barista-aide',
      scene,
      option,
      sceneTurnCount: 0
    });

    expect(reply).toBe('컵이 보여요라고 표현했습니다. 음료를 만들 준비를 해요.');
    expect(hasBannedCopy(reply)).toBe(false);
  });

  it('keeps support routes separate from scoring or turn advancement language', () => {
    const scene = getJob('barista-aide').scenes[0];
    const helpReply = createGuardedSceneReply({
      jobId: 'barista-aide',
      scene,
      option: { id: 'support-help', label: '선생님 호출', value: '선생님 도움을 요청해요', type: 'support', supportAction: 'help' },
      sceneTurnCount: 0
    });
    const pauseReply = createGuardedSceneReply({
      jobId: 'barista-aide',
      scene,
      option: { id: 'support-pause', label: '쉬고 싶어요', value: '잠깐 쉬어요', type: 'support', supportAction: 'pause' },
      sceneTurnCount: 0
    });

    expect(helpReply).toContain('도움을 요청했습니다');
    expect(pauseReply).toContain('잠시 쉬어도 괜찮습니다');
    expect(hasBannedCopy(`${helpReply} ${pauseReply}`)).toBe(false);
    expect(getCappedSceneTurnCount(0)).toBe(0);
  });

  it('falls back to guarded scene output when an overlay plan is missing', () => {
    const scene = { ...getJob('barista-aide').scenes[0], id: 'unknown-scene' };
    const fallback = getGuardedStudentSceneTurn('barista-aide', scene, 8);

    expect(fallback.turnIndex).toBe(3);
    expect(fallback.safetyFlags).toEqual(['fallback:missing_scene_plan']);
    expect(fallback.aacOptions.map((option) => option.id)).toEqual(['cups', 'tools', 'prepare']);
    expect(validateStudentSceneTurnOutput(fallback)).toMatchObject({ ok: true });
    expect(hasBannedCopy(`${fallback.voiceScript} ${fallback.displayText} ${fallback.studentQuestion}`)).toBe(false);
  });

  it('summarizes the previous scene choice as confidence-building evidence', () => {
    const job = getJob('library-aide');
    const scene = job.scenes[2];
    const option = getSceneAacOptions(scene).find((item) => item.id === 'guide-action');

    expect(option).toBeDefined();
    if (!option) throw new Error('Expected guide-action AAC option for the library guide scene.');
    const expression = getSummaryStudentExpression(option);
    const encouragement = getSummaryEncouragement(job.title, '이용 안내', option);
    const motivation = getSummaryMotivation('이용 안내', '더 알아볼래요');

    expect(expression).toBe('안내해요 선택');
    expect(encouragement).toContain('안내해요');
    expect(encouragement).toContain('중요한 선택');
    expect(motivation).toContain('다음 수업');
    expect(hasBannedCopy(`${expression} ${encouragement} ${motivation}`)).toBe(false);
  });

  it('turns student support actions into teacher review logs without scores', () => {
    const job = getJob('baker-aide');
    const log = mockCoachGateway.createSupportLog('help', { ...initialState, selectedJobId: 'baker-aide' }, job);

    expect(log).not.toBeNull();
    expect(log?.status).toBe('확인 대기');
    expect(log?.signal).toBe('도움 필요');
    expect(log?.summary).toContain('도움 요청 발생');
    expect(hasBannedCopy(`${log?.summary} ${log?.supportLevel}`)).toBe(false);
  });

  it('renders a per-session teacher summary with candidate-only scene evidence', () => {
    const job = getJob('barista-aide');
    const scene = job.scenes[0];
    const option = scene.aacOptions?.[0];
    if (!option) throw new Error('Expected a first AAC option for the barista prep scene.');
    const log = mockCoachGateway.createAacLog(option, { ...initialState, selectedJobId: job.id, selectedSceneId: scene.id }, job);

    expect(log).not.toBeNull();
    if (!log) throw new Error('Expected an AAC teacher log for summary rendering.');
    const summary = buildTeacherSessionSummary(log);

    expect(summary.summaryForTeacher).toContain('홍길동 학생');
    expect(summary.summaryForTeacher).toContain('후보 근거');
    expect(summary.sceneEvidence[0]?.summary).toContain('컵이 보여요');
    expect(summary.sceneEvidence[0]?.candidateStatusLabel).toContain('교사 확인');
    expect(summary.responseMode).toBe('AAC');
    expect(hasBannedCopy(`${summary.summaryForTeacher} ${summary.sceneEvidence[0]?.summary ?? ''}`)).toBe(false);
  });

  it('uses the selected local class-entry student in teacher logs and learning records', () => {
    const job = getJob('barista-aide');
    const scene = job.scenes[0];
    const option = scene.aacOptions?.[0];
    if (!option) throw new Error('Expected a first AAC option for the barista prep scene.');
    const state: AppState = {
      ...initialState,
      selectedJobId: job.id,
      selectedSceneId: scene.id,
      studentSession: {
        mode: 'demo',
        startedAt: '2026-06-23T13:20:00.000Z',
        classId: 'local-1',
        studentId: 'local-student-1',
        displayName: '홍길동',
        classNumber: '1'
      },
      teacherEvidenceTarget: {
        studentId: 'local-student-1',
        sessionId: 'local-session-local-student-1'
      }
    };
    const log = mockCoachGateway.createAacLog(option, state, job);
    if (!log) throw new Error('Expected an AAC teacher log for local class-entry student.');
    const record = createRecord({ ...state, teacherLogs: [log] }, job);
    const restored = mergePersistedStateForInitialLoad({
      ...initialState,
      teacherLogs: [log],
      records: [record]
    });

    expect(log).toMatchObject({
      studentName: '홍길동',
      studentId: 'local-student-1',
      sessionId: 'local-session-local-student-1'
    });
    expect(record).toMatchObject({
      studentName: '홍길동',
      logs: [expect.objectContaining({ studentName: '홍길동' })]
    });
    expect(restored.teacherLogs).toHaveLength(1);
    expect(restored.records).toHaveLength(1);
    expect(restored.teacherLogs[0]?.studentName).toBe('홍길동');
    expect(restored.records[0]?.studentName).toBe('홍길동');
  });

  it('groups multiple same-session student choices into one teacher learning card', () => {
    const firstChoice = createAiSuggestionTeacherLog({
      id: 'teacher-log-cup',
      createdAt: '2026-06-23T04:01:00.000Z',
      sessionId: 'local-session-hong',
      studentId: 'local-student-hong',
      studentName: '홍길동',
      jobId: 'barista-aide',
      jobTitle: '바리스타',
      stageLabel: '1 준비 장면',
      summary: '홍길동 학생이 "컵이 보여요"라고 선택했습니다.',
      studentExpression: '컵이 보여요',
      responseMode: 'aac'
    });
    const secondChoice = createAiSuggestionTeacherLog({
      id: 'teacher-log-tool',
      createdAt: '2026-06-23T04:02:00.000Z',
      sessionId: 'local-session-hong',
      studentId: 'local-student-hong',
      studentName: '홍길동',
      jobId: 'barista-aide',
      jobTitle: '바리스타',
      stageLabel: '1 준비 장면',
      summary: '홍길동 학생이 "도구가 보여요"라고 선택했습니다.',
      studentExpression: '도구가 보여요',
      responseMode: 'aac'
    });

    const cards = buildTeacherLearningCards([], [firstChoice, secondChoice]);

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      studentName: '홍길동',
      jobTitle: '바리스타',
      memorableScene: '준비 장면',
      studentThought: '도구가 보여요',
      status: '확인 대기'
    });
    expect(cards[0]?.logs.map((log) => log.id)).toEqual(['teacher-log-tool', 'teacher-log-cup']);
  });

  it('renders concrete next-instruction guidance for teacher action', () => {
    const job = getJob('baker-aide');
    const log = mockCoachGateway.createSupportLog('visual', { ...initialState, selectedJobId: job.id, selectedSceneId: 'tools' }, job);

    expect(log).not.toBeNull();
    if (!log) throw new Error('Expected a visual-support teacher log for guidance rendering.');
    const summary = buildTeacherSessionSummary(log);
    const guideText = summary.nextInstructionGuide.map((guide) => `${guide.action} ${guide.reason}`).join(' ');

    expect(summary.supportUsage).toContain('그림 자료');
    expect(guideText).toContain('선택지 2개');
    expect(guideText).toContain('실물 사진');
    expect(summary.teacherDecisionRequired).toContain('다음 수업 활동 선택');
    expect(hasBannedCopy(guideText)).toBe(false);
  });

  it('persists a generated completed-scene teacher decision through the mastery review API when a Todo 5 target is available', async () => {
    const job = getJob('barista-aide');
    const scene = job.scenes[0];
    const option = scene.aacOptions?.[0];
    if (!option) throw new Error('Expected a first AAC option for the barista prep scene.');
    const log = mockCoachGateway.createAacLog(
      option,
      {
        ...initialState,
        selectedJobId: job.id,
        selectedSceneId: scene.id,
        teacherEvidenceTarget: {
          sessionId: 'session-1',
          masteryReviewTarget: {
            studentId: 'student-1',
            criteriaSetId: 'criteria-set-1',
            criterionId: 'criterion-1',
            learningUnitId: 'unit-1'
          }
        }
      },
      job
    );
    const fetchCalls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    globalThis.fetch = (async (input, init) => {
      fetchCalls.push([input, init]);
      return new Response(JSON.stringify({ reviewId: 'review-1' }), { status: 201 });
    }) as typeof fetch;

    expect(log).not.toBeNull();
    if (!log) throw new Error('Expected generated backend-bound AAC teacher log.');
    const result = await persistTeacherDecision(log, 'accepted', '다음 시간에 같은 장면을 다시 봅니다.');
    const firstCall = fetchCalls[0];
    if (!firstCall) throw new Error('Expected teacher mastery review API call.');
    const requestInit = firstCall[1];
    if (!requestInit) throw new Error('Expected request init for teacher mastery review API call.');
    const body = JSON.parse(String(requestInit.body));

    expect(firstCall[0]).toBe('/api/teacher/mastery/reviews');
    expect(body).toMatchObject({
      studentId: 'student-1',
      criteriaSetId: 'criteria-set-1',
      criterionId: 'criterion-1',
      learningUnitId: 'unit-1',
      reviewSource: 'teacher_dashboard',
      reviewStatus: 'teacher_confirmed'
    });
    expect(result).toEqual({ persistedVia: 'mastery-review-api', id: 'review-1' });
    expect(log.sessionId).toBe('session-1');
    expect(log.studentId).toBe('student-1');
  });

  it.each([
    ['accepted', '후보 근거로 채택합니다.'],
    ['edited', '교사 메모를 반영해 수정합니다.'],
    ['dismissed', '이번 근거에서는 제외합니다.']
  ] as Array<[TeacherDecision, string]>)('persists an AI-suggestion dashboard %s decision against the teacher_log target', async (decision, note) => {
    const log = createAiSuggestionTeacherLog();
    const fetchCalls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    globalThis.fetch = (async (input, init) => {
      fetchCalls.push([input, init]);
      return new Response(JSON.stringify({ decisionId: `decision-${decision}` }), { status: 201 });
    }) as typeof fetch;

    const result = await persistTeacherDecision(log, decision, note);
    const firstCall = fetchCalls[0];
    if (!firstCall) throw new Error('Expected teacher AI decision API call.');
    const requestInit = firstCall[1];
    if (!requestInit) throw new Error('Expected request init for teacher AI decision API call.');
    const body = JSON.parse(String(requestInit.body));

    expect(firstCall[0]).toBe('/api/teacher/ai-assistance/suggestions/suggestion-1/decisions');
    expect(body).toMatchObject({
      decision,
      teacherNote: note,
      appliedTo: 'teacher_log',
      appliedTeacherLogId: 'teacher-log-1'
    });
    if (decision === 'edited') {
      expect(body.editedText).toBe(note);
    } else {
      expect(body).not.toHaveProperty('editedText');
    }
    expect(result).toEqual({ persistedVia: 'ai-assistance-decision-api', id: `decision-${decision}` });
  });

  it('keeps a generated backend-bound dashboard decision retryable when persistence is unavailable', async () => {
    const job = getJob('library-aide');
    const scene = job.scenes[1];
    const option = scene.aacOptions?.[0];
    if (!option) throw new Error('Expected a first AAC option for the library shelf scene.');
    const log = mockCoachGateway.createAacLog(
      option,
      {
        ...initialState,
        selectedJobId: job.id,
        selectedSceneId: scene.id,
        teacherEvidenceTarget: {
          sessionId: 'session-retry-1',
          masteryReviewTarget: {
            studentId: 'student-retry-1',
            criteriaSetId: 'criteria-set-retry-1',
            criterionId: 'criterion-retry-1',
            learningUnitId: 'unit-retry-1'
          }
        }
      },
      job
    );

    expect(log).not.toBeNull();
    if (!log) throw new Error('Expected generated backend-bound AAC teacher log.');
    const decided = await confirmTeacherLogDecision(log, 'edited', '그림 자료를 먼저 둡니다.', async () => {
      throw new Error('teacher_mastery_review_failed_500');
    });

    expect(decided.status).toBe('저장 오류');
    expect(decided.status).not.toBe('기록 완료');
    expect(decided.decisionHistory?.[0]).toMatchObject({
      decision: 'edited',
      persistedVia: 'failed'
    });
    expect(decided.decisionHistory?.[0]?.note).toContain('서버 저장 대기');
    expect(decided.summary).toContain('교사 조치 저장 대기');
    expect(hasBannedCopy(decided.summary)).toBe(false);
  });

  it('keeps an AI-suggestion dashboard decision retryable without adding duplicate local-only history', async () => {
    const log = createAiSuggestionTeacherLog({
      decisionHistory: [
        {
          decision: 'accepted',
          note: '이전 AI 결정 저장',
          createdAt: '2026-06-22T00:00:00.000Z',
          persistedVia: 'ai-assistance-decision-api'
        }
      ]
    });

    const decided = await confirmTeacherLogDecision(log, 'dismissed', '다음 관찰로 연결합니다.', async () => {
      throw new Error('teacher_ai_decision_failed_500');
    });

    expect(decided.status).toBe('저장 오류');
    expect(decided.decisionHistory).toHaveLength(2);
    expect(decided.decisionHistory?.filter((item) => item.persistedVia === 'local')).toHaveLength(0);
    expect(decided.decisionHistory?.[1]).toMatchObject({
      decision: 'dismissed',
      persistedVia: 'failed'
    });
    expect(decided.decisionHistory?.[1]?.note).toContain('서버 저장 대기');
    expect(decided.summary).toContain('교사 조치 저장 대기');
  });

  it('applies accept edit and reject teacher actions without banned evaluation wording', () => {
    const log = mockCoachGateway.createAacLog(
      { id: 'cups', label: '컵', value: '컵이 보여요', type: 'object' },
      initialState,
      getJob('barista-aide')
    );

    expect(log).not.toBeNull();
    if (!log) throw new Error('Expected an AAC teacher log for decision action coverage.');
    const accepted = applyTeacherDecisionToLog(log, 'accepted', '', 'local');
    const edited = applyTeacherDecisionToLog(log, 'edited', '사진 자료를 먼저 둡니다.', 'mastery-review-api');
    const dismissed = applyTeacherDecisionToLog(log, 'dismissed', '다음 관찰로 연결합니다.', 'local');
    const visibleText = [accepted.summary, edited.summary, dismissed.summary, accepted.decisionHistory?.[0]?.note, edited.decisionHistory?.[0]?.note, dismissed.decisionHistory?.[0]?.note].join(' ');

    expect(accepted.status).toBe('기록 완료');
    expect(edited.decisionHistory?.[0]?.persistedVia).toBe('mastery-review-api');
    expect(dismissed.status).toBe('참고 기록');
    expect(visibleText).toContain('근거 채택');
    expect(visibleText).toContain('수정해서 저장');
    expect(visibleText).toContain('보류하고 다시 보기');
    expect(hasBannedCopy(visibleText)).toBe(false);
  });

  it('keeps student management visible as a teacher dashboard navigation item', () => {
    expect(teacherDashboardNavigation.map((item) => item.label)).toContain('학생 관리');
    expect(teacherDashboardNavigation.find((item) => item.id === 'students')?.Icon).toBeDefined();
  });

  it('keeps support staff read-only for roster management controls', () => {
    expect(canManageRoster('admin')).toBe(true);
    expect(canManageRoster('teacher')).toBe(true);
    expect(canManageRoster('support_staff')).toBe(false);
    expect(canManageRoster(null)).toBe(false);
  });

  it('calls the real roster and launch-code API contract for teacher student management', async () => {
    const fetchCalls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    globalThis.fetch = (async (input, init) => {
      fetchCalls.push([input, init]);
      const url = String(input);
      if (url === '/api/auth/me') {
        return new Response(JSON.stringify({
          teacher: { id: 'teacher-1', schoolId: 'school-1', role: 'teacher', displayName: '김교사' }
        }), { status: 200 });
      }
      if (url === '/api/classes') {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({
            class: { id: 'class-2', name: '3학년 2반', gradeLabel: null, schoolYear: 2026, active: true }
          }), { status: 201 });
        }
        return new Response(JSON.stringify({
          classes: [{ id: 'class-1', name: '1반', gradeLabel: '고1', schoolYear: 2026, active: true }]
        }), { status: 200 });
      }
      if (url === '/api/classes/class-1/students' && init?.method === 'POST') {
        return new Response(JSON.stringify({
          student: { id: 'student-2', classId: 'class-1', studentCode: 'S002', displayName: '새 학생', classNumber: '2', active: true }
        }), { status: 201 });
      }
      if (url === '/api/classes/class-1/students') {
        return new Response(JSON.stringify({
          students: [{ id: 'student-1', classId: 'class-1', studentCode: 'S001', displayName: '홍길동', classNumber: '1', active: true }]
        }), { status: 200 });
      }
      if (url === '/api/students/student-2') {
        return new Response(JSON.stringify({
          student: { id: 'student-2', classId: 'class-1', studentCode: 'S002A', displayName: '수정 학생', classNumber: '4', active: false }
        }), { status: 200 });
      }
      if (url === '/api/students/student-2/launch-code') {
        return new Response(JSON.stringify({
          launchCode: 'ABCD-1234',
          expiresAt: '2026-06-22T12:15:00.000Z',
          student: { id: 'student-2', classId: 'class-1' }
        }), { status: 201 });
      }
      if (url === '/api/classes/class-1/entry-session') {
        return new Response(JSON.stringify({
          entryToken: 'entry-token-1',
          expiresAt: '2026-06-22T16:00:00.000Z',
          class: { id: 'class-1', name: '1반' },
          students: [{ id: 'student-1', classId: 'class-1', displayName: '홍길동', classNumber: '1' }]
        }), { status: 201 });
      }
      if (url === '/api/class-entry/entry-token-1') {
        return new Response(JSON.stringify({
          expiresAt: '2026-06-22T16:00:00.000Z',
          class: { id: 'class-1', name: '1반' },
          students: [{ id: 'student-1', classId: 'class-1', displayName: '홍길동', classNumber: '1' }]
        }), { status: 200 });
      }
      if (url === '/api/class-entry/entry-token-1/students/student-1/start') {
        return new Response(JSON.stringify({
          student: { id: 'student-1', classId: 'class-1' },
          studentToken: 'student-token-from-entry'
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    }) as typeof fetch;

    await expect(fetchTeacherMe()).resolves.toMatchObject({ id: 'teacher-1', role: 'teacher' });
    await expect(fetchTeacherClasses()).resolves.toHaveLength(1);
    await expect(createTeacherClass({ name: '3학년 2반', schoolYear: 2026 })).resolves.toMatchObject({
      id: 'class-2',
      name: '3학년 2반'
    });
    await expect(fetchClassStudents('class-1')).resolves.toHaveLength(1);
    await expect(createRosterStudent('class-1', {
      studentCode: 'S002',
      displayName: '새 학생',
      classNumber: '2'
    })).resolves.toMatchObject({ id: 'student-2', studentCode: 'S002' });
    await expect(updateRosterStudent('student-2', {
      studentCode: 'S002A',
      displayName: '수정 학생',
      classNumber: '4',
      active: false
    })).resolves.toMatchObject({ active: false, displayName: '수정 학생' });
    await expect(generateStudentLaunchCode('student-2')).resolves.toMatchObject({ launchCode: 'ABCD-1234' });
    await expect(startTeacherClassEntrySession('class-1')).resolves.toMatchObject({
      entryToken: 'entry-token-1',
      students: [{ displayName: '홍길동' }]
    });
    await expect(fetchClassEntrySession('entry-token-1')).resolves.toMatchObject({
      class: { id: 'class-1' },
      students: [{ id: 'student-1' }]
    });
    await expect(startClassEntryStudent('entry-token-1', 'student-1')).resolves.toMatchObject({
      mode: 'api',
      classId: 'class-1',
      studentId: 'student-1',
      studentToken: 'student-token-from-entry'
    });

    const createCall = fetchCalls.find(([url, init]) => String(url) === '/api/classes/class-1/students' && init?.method === 'POST');
    const createClassCall = fetchCalls.find(([url, init]) => String(url) === '/api/classes' && init?.method === 'POST');
    const updateCall = fetchCalls.find(([url, init]) => String(url) === '/api/students/student-2' && init?.method === 'PATCH');
    const launchCall = fetchCalls.find(([url, init]) => String(url) === '/api/students/student-2/launch-code' && init?.method === 'POST');
    const entryStartCall = fetchCalls.find(([url, init]) => String(url) === '/api/classes/class-1/entry-session' && init?.method === 'POST');
    const classEntryStudentCall = fetchCalls.find(([url, init]) => String(url) === '/api/class-entry/entry-token-1/students/student-1/start' && init?.method === 'POST');

    expect(createCall).toBeDefined();
    expect(createClassCall).toBeDefined();
    expect(updateCall).toBeDefined();
    expect(launchCall).toBeDefined();
    expect(entryStartCall).toBeDefined();
    expect(classEntryStudentCall).toBeDefined();
    expect(JSON.parse(String(createClassCall?.[1]?.body))).toMatchObject({ name: '3학년 2반', schoolYear: 2026 });
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({ studentCode: 'S002', displayName: '새 학생', classNumber: '2' });
    expect(JSON.parse(String(updateCall?.[1]?.body))).toMatchObject({ active: false });
  });

  it('maps duplicate code, unauthorized, inactive class, and network roster failures to recoverable teacher copy', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'duplicate_student_code' }), { status: 409 })) as typeof fetch;
    await createRosterStudent('class-1', { studentCode: 'S001', displayName: '중복 학생', classNumber: '1' }).catch((error) => {
      expect(getRosterErrorMessage(error)).toContain('이름과 번호');
    });

    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'roster_write_denied' }), { status: 403 })) as typeof fetch;
    await updateRosterStudent('student-1', { displayName: '권한 없음' }).catch((error) => {
      expect(getRosterErrorMessage(error)).toContain('권한이 없습니다');
    });

    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'class_not_found' }), { status: 404 })) as typeof fetch;
    await fetchClassStudents('inactive-class').catch((error) => {
      expect(getRosterErrorMessage(error)).toContain('비활성화');
    });

    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError('network down');
      return new Response(JSON.stringify({ classes: [] }), { status: 200 });
    }) as typeof fetch;

    await fetchTeacherClasses().catch((error) => {
      expect(getRosterErrorMessage(error)).toContain('다시 시도');
    });
    await expect(fetchTeacherClasses()).resolves.toEqual([]);
    expect(attempts).toBe(2);
  });

  it('resolves a valid student launch code and stores only bounded session context in app state', async () => {
    const studentToken = 'student-token-secret-for-test';
    const fetchCalls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    globalThis.fetch = (async (input, init) => {
      fetchCalls.push([input, init]);
      const url = String(input);
      if (url === '/api/student/resolve') {
        return new Response(JSON.stringify({
          student: { id: 'student-1', classId: 'class-1' },
          studentToken
        }), { status: 200 });
      }
      if (url === '/api/exploration-sessions') {
        return new Response(JSON.stringify({ sessionId: 'session-1' }), { status: 201 });
      }
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    }) as typeof fetch;

    const context = await resolveStudentLaunch({ classId: 'class-1', studentCode: 'S001', launchCode: 'LAUNCH-123' });
    const resolvedState = applyResolvedStudentContext(initialState, context);
    const sessionId = await createExplorationSession(context, 'barista-aide');
    const startedState = applyStartedStudentSession(resolvedState, sessionId);

    expect(context).toMatchObject({ mode: 'api', classId: 'class-1', studentId: 'student-1', studentToken });
    expect(resolvedState.view).toBe('intro');
    expect(startedState.teacherEvidenceTarget).toMatchObject({ studentId: 'student-1', sessionId: 'session-1' });
    expect(startedState.studentSession).toMatchObject({ mode: 'api', sessionId: 'session-1' });

    const resolveCall = fetchCalls.find(([url]) => String(url) === '/api/student/resolve');
    const sessionCall = fetchCalls.find(([url]) => String(url) === '/api/exploration-sessions');
    expect(JSON.parse(String(resolveCall?.[1]?.body))).toMatchObject({
      classId: 'class-1',
      studentCode: 'S001',
      launchCode: 'LAUNCH-123'
    });
    expect(String(sessionCall?.[1]?.body)).not.toContain(studentToken);
    expect(sessionCall?.[1]?.headers).toMatchObject({ authorization: `Student ${studentToken}` });
  });

  it('keeps invalid or expired launch codes on a retryable launch state without echoing token-like text', () => {
    const expired = new ApiClientError(401, 'launch_code_expired', 'student-token-secret-for-test');
    const used = new ApiClientError(401, 'launch_code_used', 'student-token-secret-for-test');
    const locked = new ApiClientError(429, 'student_resolve_locked');

    expect(getStudentLaunchErrorMessage(expired)).toContain('새 코드를 요청');
    expect(getStudentLaunchErrorMessage(used)).toContain('이미 사용한');
    expect(getStudentLaunchErrorMessage(locked)).toContain('15분');
    expect(getStudentLaunchErrorMessage(expired)).not.toContain('student-token-secret-for-test');
  });

  it('propagates student session context to backend record and response calls without putting the token in JSON bodies', async () => {
    const studentToken = 'student-token-secret-for-records';
    const context = {
      mode: 'api' as const,
      classId: 'class-1',
      studentId: 'student-1',
      studentToken,
      sessionId: 'session-1',
      startedAt: '2026-06-22T00:00:00.000Z'
    };
    const fetchCalls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    globalThis.fetch = (async (input, init) => {
      fetchCalls.push([input, init]);
      const url = String(input);
      if (url.endsWith('/responses')) return new Response(JSON.stringify({ responseId: 'response-1' }), { status: 201 });
      if (url.endsWith('/records')) return new Response(JSON.stringify({ recordId: 'record-1' }), { status: 201 });
      if (url.endsWith('/complete')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    }) as typeof fetch;

    await expect(createExplorationSessionResponse(context, {
      jobSceneId: 'prep',
      inputMode: 'aac',
      selectedValue: '컵이 보여요',
      interpretedResponse: '컵이 보여요라고 표현했습니다.',
      supportUsed: 'aac'
    })).resolves.toBe('response-1');
    await expect(createExplorationSessionRecord(context, {
      memorableSceneId: 'prep',
      studentThought: '해보고 싶어요',
      edenNote: '다음 수업에서 이어볼 수 있어요.'
    })).resolves.toBe('record-1');
    await expect(completeExplorationSession(context)).resolves.toBeUndefined();

    for (const [, init] of fetchCalls) {
      expect(init?.headers).toMatchObject({ authorization: `Student ${studentToken}` });
      expect(String(init?.body)).not.toContain(studentToken);
    }
    expect(fetchCalls.map(([url]) => String(url))).toEqual([
      '/api/exploration-sessions/session-1/responses',
      '/api/exploration-sessions/session-1/records',
      '/api/exploration-sessions/session-1/complete'
    ]);
  });

  it('passes session id and student context to avatar speech without writing the token into the JSON body', async () => {
    const studentToken = 'student-token-secret-for-speech';
    const fetchCalls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      atob: (value: string) => Buffer.from(value, 'base64').toString('binary')
    });
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:avatar-speech',
      revokeObjectURL: () => undefined
    });
    globalThis.fetch = (async (input, init) => {
      fetchCalls.push([input, init]);
      return new Response(JSON.stringify({
        provider: 'openai',
        mimeType: 'audio/mpeg',
        audioBase64: Buffer.from('audio').toString('base64')
      }), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
    }) as typeof fetch;

    const audio = await requestAvatarSpeech('다시 들어요', 'alloy', { sessionId: 'session-1', studentToken });
    const requestBody = JSON.parse(String(fetchCalls[0]?.[1]?.body));

    expect(audio.url).toBe('blob:avatar-speech');
    expect(fetchCalls[0]?.[0]).toBe('/api/avatar/speak');
    expect(fetchCalls[0]?.[1]?.headers).toMatchObject({ 'x-student-context': studentToken });
    expect(requestBody).toMatchObject({ input: '다시 들어요', sessionId: 'session-1' });
    expect(String(fetchCalls[0]?.[1]?.body)).not.toContain(studentToken);
  });

  it('reports non-JSON avatar speech responses as HTTP failures', async () => {
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      atob: (value: string) => Buffer.from(value, 'base64').toString('binary')
    });
    globalThis.fetch = (async () =>
      new Response('<!DOCTYPE html><title>Not found</title>', {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })) as typeof fetch;

    await expect(requestAvatarSpeech('다시 들어요', 'alloy', { sessionId: 'session-1' })).rejects.toThrow(
      'avatar_voice_http_404'
    );
  });
});
