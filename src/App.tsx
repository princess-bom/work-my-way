import { useRef, useState } from 'react';
import { requestSupportPacket } from './api';
import { BrandMark } from './components/BrandMark';
import { StudentExperience } from './components/StudentExperience';
import { TeacherConsole } from './components/TeacherConsole';
import {
  createMasteryDemoView,
  type CanonicalChoiceId,
  type SupportRequest
} from './components/masteryDemo';
import { createDemoStore, type DemoStore } from './data/demo-store';
import { libraryScene } from './data/demo';
import type { SupportAction, SupportPacketResponse } from '../shared/support-schema';

type View = 'student' | 'teacher';

export default function App() {
  const storeRef = useRef<DemoStore | null>(null);
  if (storeRef.current === null) storeRef.current = createDemoStore();
  const store = storeRef.current;

  const [demoState, setDemoState] = useState(() => store.getSnapshot());
  const [view, setView] = useState<View>('student');
  const [supportRequest, setSupportRequest] = useState<SupportRequest | null>(null);
  const [supportPacket, setSupportPacket] = useState<SupportPacketResponse | null>(null);
  const [loadingSupport, setLoadingSupport] = useState<SupportRequest | null>(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState<CanonicalChoiceId | null>(() => {
    const savedAttempt = store.getSnapshot().attempts.find((attempt) => attempt.sessionId === 'session-library-3');
    return savedAttempt?.selectedChoiceId ?? null;
  });
  const currentAttempt = demoState.attempts.find((attempt) => attempt.sessionId === 'session-library-3');
  const mastery = store.getMastery(demoState.goals[0].id);
  const demo = createMasteryDemoView(demoState);

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
    if (request === 'break') return 'direct_model' as const;
    return 'none' as const;
  }

  async function handleSupport(request: SupportRequest) {
    setSupportRequest(request);
    setSupportPacket(null);
    setLoadingSupport(request);
    const recordedCurrentAttempt = store.getSnapshot().attempts.find((attempt) => attempt.sessionId === 'session-library-3');
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

  function handleChoice(choiceId: CanonicalChoiceId) {
    if (selectedChoiceId) return;
    const isCanonical = choiceId === 'return-cart';
    store.recordAttempt({
      id: `attempt-library-3-${crypto.randomUUID()}`,
      goalId: demoState.goals[0].id,
      sessionId: 'session-library-3',
      occurredAt: new Date().toISOString(),
      criterionMet: isCanonical,
      supportLevel: supportLevelFor(supportRequest),
      selectedChoiceId: choiceId,
      observation: isCanonical ? 'completed_observable_step' : 'step_not_yet_completed'
    });
    setSelectedChoiceId(choiceId);
    refreshFromStore();
  }

  function handleConfirm() {
    if (mastery.status !== 'ready_for_teacher_review' || !mastery.evidenceAttemptIds) return;
    store.recordTeacherDecision({
      id: `decision-library-3-${crypto.randomUUID()}`,
      goalId: demoState.goals[0].id,
      educatorProfileId: 'profile-educator-rivera',
      decidedAt: new Date().toISOString(),
      decision: 'confirm_mastery',
      evidenceAttemptIds: mastery.evidenceAttemptIds
    });
    refreshFromStore();
  }

  function resetDemo() {
    store.reset();
    setSupportRequest(null);
    setSupportPacket(null);
    setLoadingSupport(null);
    refreshFromStore();
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
        onBack={() => setView('student')}
      />
    );
  }

  return (
    <div className="app-frame">
      <header className="app-header">
        <BrandMark />
        <div className="header-actions">
          <div className="prototype-note" role="note">
            Synthetic demo · Adult evaluators only · No real learner data
          </div>
          <button className="reset-demo" type="button" onClick={resetDemo} data-testid="reset-demo">
            Reset synthetic demo
          </button>
        </div>
      </header>
      <StudentExperience
        demo={demo}
        supportRequest={supportRequest}
        supportPacket={supportPacket}
        loadingSupport={loadingSupport}
        selectedChoiceId={selectedChoiceId}
        onSupport={handleSupport}
        onSelectChoice={handleChoice}
        onOpenTeacher={() => setView('teacher')}
      />
    </div>
  );
}
