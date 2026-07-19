import { useEffect, useRef, useState } from 'react';
import {
  DEMO_RUN_ID_KEY,
  getDemoRun,
  recordDemoAttempt,
  recordDemoTeacherDecision,
  requestSupportPacket,
  resetDemoRun,
  startDemoRun
} from './api';
import { JobIntro } from './components/JobIntro';
import { LandingCarousel } from './components/LandingCarousel';
import { LearningSummary } from './components/LearningSummary';
import { LibraryLearning } from './components/LibraryLearning';
import { RecordsView } from './components/RecordsView';
import { StudentEntry } from './components/StudentEntry';
import { TeacherConsole } from './components/TeacherConsole';
import {
  createMasteryDemoView,
  type CanonicalChoiceId,
  type SupportRequest
} from './components/masteryDemo';
import { createDemoStore, type DemoStore } from './data/demo-store';
import { libraryScene } from './data/demo';
import { getJob, type JobId } from './data/jobs';
import type { SupportAction, SupportPacketResponse } from '../shared/support-schema';
import { evaluateMastery } from './domain/mastery';
import type { DemoEnvelope, PersistenceMode } from '../shared/demo-api';
import { RealtimeCoach } from './realtime-coach';

type View = 'landing' | 'entry' | 'intro' | 'learning' | 'summary' | 'records' | 'teacher';

export default function App() {
  const storeRef = useRef<DemoStore | null>(null);
  if (storeRef.current === null) storeRef.current = createDemoStore();
  const store = storeRef.current;

  const [demoState, setDemoState] = useState(() => store.getSnapshot());
  const [view, setView] = useState<View>('landing');
  const [selectedJobId, setSelectedJobId] = useState<JobId>('barista-aide');
  const [supportRequest, setSupportRequest] = useState<SupportRequest | null>(null);
  const [supportPacket, setSupportPacket] = useState<SupportPacketResponse | null>(null);
  const [loadingSupport, setLoadingSupport] = useState<SupportRequest | null>(null);
  const [voiceState, setVoiceState] = useState<'idle' | 'connecting' | 'active'>('idle');
  const [voiceMessage, setVoiceMessage] = useState('말하기는 선택이에요. 그림 버튼으로도 대답할 수 있어요.');
  const [runId, setRunId] = useState<string | null>(null);
  const [persistence, setPersistence] = useState<PersistenceMode | 'device_fallback'>('device_fallback');
  const [selectedChoiceId, setSelectedChoiceId] = useState<CanonicalChoiceId | null>(() => {
    const savedAttempt = store.getSnapshot().attempts.find((attempt) => attempt.sessionId === 'session-library-3');
    return savedAttempt?.selectedChoiceId ?? null;
  });
  const realtimeRef = useRef<RealtimeCoach | null>(null);
  if (realtimeRef.current === null) {
    realtimeRef.current = new RealtimeCoach({ onState: setVoiceState, onMessage: setVoiceMessage });
  }

  const currentAttempt = demoState.attempts.find((attempt) => attempt.sessionId === 'session-library-3');
  const mastery = evaluateMastery(demoState.goals[0].id, demoState.attempts, demoState.teacherDecisions);
  const demo = createMasteryDemoView(demoState);
  const selectedJob = getJob(selectedJobId);
  const persistenceLabel = persistence === 'postgres'
    ? '서버에 저장됨'
    : persistence === 'memory_fallback'
      ? '데모 서버 임시 저장'
      : '이 기기에 임시 저장';

  useEffect(() => {
    let cancelled = false;
    async function connectDemoRun() {
      try {
        const savedRunId = window.localStorage.getItem(DEMO_RUN_ID_KEY);
        let envelope: DemoEnvelope;
        try {
          envelope = savedRunId ? await getDemoRun(savedRunId) : await startDemoRun();
        } catch {
          envelope = await startDemoRun();
        }
        if (cancelled) return;
        window.localStorage.setItem(DEMO_RUN_ID_KEY, envelope.runId);
        applyEnvelope(envelope);
      } catch {
        if (!cancelled) setPersistence('device_fallback');
      }
    }
    void connectDemoRun();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (view !== 'learning') realtimeRef.current?.stop();
  }, [view]);

  useEffect(() => () => realtimeRef.current?.stop(), []);

  function applyEnvelope(envelope: DemoEnvelope) {
    store.replaceSnapshot(envelope.state);
    setRunId(envelope.persistence === 'postgres' ? envelope.runId : null);
    setPersistence(envelope.persistence === 'postgres' ? 'postgres' : 'device_fallback');
    setDemoState(envelope.state);
    const savedAttempt = envelope.state.attempts.find((attempt) => attempt.sessionId === 'session-library-3');
    setSelectedChoiceId(savedAttempt?.selectedChoiceId ?? null);
  }

  function refreshFromStore() {
    const nextState = store.getSnapshot();
    const savedAttempt = nextState.attempts.find((attempt) => attempt.sessionId === 'session-library-3');
    setDemoState(nextState);
    setSelectedChoiceId(savedAttempt?.selectedChoiceId ?? null);
  }

  function supportActionFor(request: SupportRequest): SupportAction {
    if (request === 'show') return 'visual';
    if (request === 'help') return 'help';
    return 'pause';
  }

  function supportLevelFor(request: SupportRequest | null) {
    if (request === 'show') return 'visual_choice' as const;
    if (request === 'help') return 'verbal_prompt' as const;
    if (request === 'break') return 'none' as const;
    return 'none' as const;
  }

  async function handleSupport(request: SupportRequest) {
    setSupportRequest(request);
    setSupportPacket(null);
    setLoadingSupport(request);
    const recordedCurrentAttempt = demoState.attempts.find((attempt) => attempt.sessionId === 'session-library-3');
    const goal = demoState.goals[0];
    const response = await requestSupportPacket({
      action: supportActionFor(request),
      scene: libraryScene,
      selectedChoice: selectedChoiceId ?? undefined,
      goalContext: {
        targetSkill: goal.skillLabel,
        observableCriterion: goal.observableCriterion
      },
      supportContext: {
        currentSupport: supportLevelFor(request),
        recentOutcome: recordedCurrentAttempt
          ? (recordedCurrentAttempt.criterionMet ? 'criterion_met' : 'criterion_not_met')
          : 'not_attempted'
      }
    });
    setSupportPacket(response);
    setLoadingSupport(null);
  }

  async function handleChoice(choiceId: CanonicalChoiceId) {
    if (selectedChoiceId) return;
    const attemptInput = {
      id: `attempt-library-3-${crypto.randomUUID()}`,
      selectedChoiceId: choiceId,
      supportRequest
    } as const;
    setSelectedChoiceId(choiceId);
    if (runId) {
      try {
        applyEnvelope(await recordDemoAttempt(runId, attemptInput));
        return;
      } catch {
        setPersistence('device_fallback');
      }
    }
    const isCanonical = choiceId === 'return-cart';
    store.recordAttempt({
      id: attemptInput.id,
      goalId: demoState.goals[0].id,
      sessionId: 'session-library-3',
      occurredAt: new Date().toISOString(),
      criterionMet: isCanonical,
      supportLevel: supportLevelFor(supportRequest),
      selectedChoiceId: choiceId,
      observation: isCanonical ? 'completed_observable_step' : 'step_not_yet_completed'
    });
    refreshFromStore();
  }

  async function handleConfirm() {
    if (mastery.status !== 'ready_for_teacher_review' || !mastery.evidenceAttemptIds) return;
    const decisionId = `decision-library-3-${crypto.randomUUID()}`;
    const decision = {
      id: decisionId,
      decision: 'confirm_mastery'
    } as const;
    const localDecision = {
      id: decisionId,
      goalId: demoState.goals[0].id,
      educatorProfileId: demoState.profiles.find((profile) => profile.role === 'educator')!.id,
      decidedAt: new Date().toISOString(),
      decision: 'confirm_mastery',
      evidenceAttemptIds: mastery.evidenceAttemptIds
    } as const;
    if (runId) {
      try {
        applyEnvelope(await recordDemoTeacherDecision(runId, decision));
        return;
      } catch {
        setPersistence('device_fallback');
      }
    }
    store.recordTeacherDecision(localDecision);
    refreshFromStore();
  }

  async function resetDemo() {
    if (runId) {
      try {
        applyEnvelope(await resetDemoRun(runId));
      } catch {
        setPersistence('device_fallback');
        store.reset();
        refreshFromStore();
      }
    } else {
      store.reset();
      refreshFromStore();
    }
    setSupportRequest(null);
    setSupportPacket(null);
    setLoadingSupport(null);
    realtimeRef.current?.stop();
    setVoiceMessage('말하기는 선택이에요. 그림 버튼으로도 대답할 수 있어요.');
    setView('landing');
  }

  function openJob(jobId: JobId) {
    setSelectedJobId(jobId);
    setView(jobId === 'library-aide' ? 'entry' : 'intro');
  }

  function openLibrary() {
    setSelectedJobId('library-aide');
    setView('entry');
  }

  async function handleVoicePreview() {
    if (voiceState !== 'idle') {
      realtimeRef.current?.stop();
      setVoiceMessage('음성 대화를 멈췄어요. 그림 버튼으로 계속할 수 있어요.');
      return;
    }
    if (!runId) {
      setVoiceMessage('데모 세션을 준비하고 있어요. 잠시 뒤 다시 눌러 주세요.');
      return;
    }
    try {
      await realtimeRef.current?.start(runId);
    } catch {
      setVoiceMessage('음성 연결을 사용할 수 없어요. 그림 버튼으로 계속할 수 있어요.');
    }
  }

  if (view === 'teacher') {
    return (
      <TeacherConsole
        demo={demo}
        supportRequest={supportRequest}
        selectedChoiceId={selectedChoiceId}
        supportPacket={supportPacket}
        currentSupportLevel={currentAttempt?.supportLevel}
        masteryStatus={mastery.status}
        onConfirm={handleConfirm}
        onBack={() => setView(selectedChoiceId ? 'records' : 'landing')}
        onReset={resetDemo}
      />
    );
  }

  if (view === 'landing') {
    return <LandingCarousel initialJobId={selectedJobId} onStart={openJob} onTeacher={() => setView('teacher')} />;
  }

  if (view === 'entry') {
    return <StudentEntry onBack={() => setView('landing')} onEnter={() => setView('intro')} />;
  }

  if (view === 'intro') {
    return (
      <JobIntro
        job={selectedJob}
        onBack={() => setView(selectedJob.demoReady ? 'entry' : 'landing')}
        onStartLearning={() => setView('learning')}
        onChooseLibrary={openLibrary}
      />
    );
  }

  if (view === 'learning') {
    return (
      <LibraryLearning
        supportRequest={supportRequest}
        supportPacket={supportPacket}
        loadingSupport={loadingSupport}
        selectedChoiceId={selectedChoiceId}
        onBack={() => setView('intro')}
        onSupport={handleSupport}
        onSelectChoice={handleChoice}
        onNext={() => setView('summary')}
        onStartVoice={handleVoicePreview}
        voiceLabel={voiceState === 'active' ? '대화 멈추기' : '이든과 말하기'}
        voicePending={voiceState === 'connecting'}
        voiceActive={voiceState === 'active'}
        voiceMessage={voiceMessage}
        persistenceLabel={persistenceLabel}
      />
    );
  }

  if (view === 'summary') {
    return (
      <LearningSummary
        selectedChoiceId={selectedChoiceId}
        masteryStatus={mastery.status}
        onBack={() => setView('learning')}
        onRecords={() => setView('records')}
        onRepeat={() => setView('learning')}
      />
    );
  }

  return (
    <RecordsView
      masteryStatus={mastery.status}
      currentSupportLevel={currentAttempt?.supportLevel}
      onBack={() => setView('summary')}
      onTeacher={() => setView('teacher')}
      onHome={() => setView('landing')}
      persistenceLabel={persistenceLabel}
    />
  );
}
