import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  HandHelping,
  LockKeyhole,
  Pause,
  RotateCcw,
  Target
} from 'lucide-react';
import {
  feedbackForChoice,
  type CanonicalChoiceId,
  type MasteryDemoViewModel,
  type SupportRequest
} from './masteryDemo';

type StudentExperienceProps = {
  demo: MasteryDemoViewModel;
  supportRequest: SupportRequest | null;
  selectedChoiceId: CanonicalChoiceId | null;
  onSupport: (request: SupportRequest) => void;
  onSelectChoice: (choiceId: CanonicalChoiceId) => void;
  onOpenTeacher: () => void;
};

const supportActions = [
  { request: 'show' as const, label: 'Show me', description: 'See the choices clearly', icon: Eye },
  { request: 'help' as const, label: 'Help', description: 'Get one guiding prompt', icon: HandHelping },
  { request: 'break' as const, label: 'Break', description: 'Pause and take one step', icon: Pause }
];

export function StudentExperience({
  demo,
  supportRequest,
  selectedChoiceId,
  onSupport,
  onSelectChoice,
  onOpenTeacher
}: StudentExperienceProps) {
  const feedbackRef = useRef<HTMLElement>(null);
  const selectedChoice = demo.activity.choices.find((choice) => choice.id === selectedChoiceId) ?? null;

  useEffect(() => {
    if (!selectedChoice || !window.matchMedia('(max-width: 660px)').matches) return;
    feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedChoice]);

  return (
    <main className="student-shell">
      <aside className="student-sidebar" aria-label="Learning journey">
        <div className="learner-identity">
          <span className="learner-avatar" aria-hidden="true">{demo.learner.initials}</span>
          <span>
            <small>Synthetic learner</small>
            <strong>{demo.learner.name}</strong>
          </span>
        </div>

        <section className="sidebar-goal" aria-labelledby="sidebar-goal-title">
          <Target size={19} aria-hidden="true" />
          <div>
            <span id="sidebar-goal-title">My learning goal</span>
            <p>{demo.learningGoal}</p>
          </div>
        </section>

        <ol className="session-steps" aria-label="Mastery sessions">
          {demo.previousSessions.map((session) => (
            <li className="is-complete" key={session.id}>
              <span><Check size={13} strokeWidth={3} /></span>
              <div><strong>{session.label}</strong><small>{session.dateLabel}</small></div>
            </li>
          ))}
          <li className="is-current" aria-current="step">
            <span>3</span>
            <div><strong>Session 3</strong><small>Current attempt</small></div>
          </li>
          <li className="is-locked">
            <span><LockKeyhole size={13} /></span>
            <div><strong>{demo.futureStage.title}</strong><small>{demo.futureStage.description}</small></div>
          </li>
        </ol>
      </aside>

      <section className="student-workspace">
        <div className="evaluator-banner" role="note">
          <strong>Synthetic demonstration</strong>
          <span>{demo.learner.notice}. This screen does not collect diagnoses, suitability scores, or real learner responses.</span>
        </div>

        <div className="workspace-topline">
          <div className="scene-label">
            <BookOpen size={18} />
            {demo.activity.attemptLabel}
          </div>
          <button className="teacher-link" type="button" onClick={onOpenTeacher}>
            Teacher timeline <ArrowRight size={16} />
          </button>
        </div>

        <div className="student-content-grid">
          <div className="activity-column">
            <section className="goal-banner" aria-labelledby="learning-goal-title">
              <Target size={21} aria-hidden="true" />
              <div>
                <span id="learning-goal-title">My learning goal</span>
                <strong>{demo.learningGoal}</strong>
              </div>
            </section>

            <article className="mastery-activity">
              <div className="activity-visual">
                <img src="/assets/library-diorama.avif" alt="Illustrated library return desk with a book cart and shelves" />
                <div className="activity-visual-label">
                  <BookOpen size={16} />
                  <span><strong>{demo.activity.title}</strong><small>Work scene practice</small></span>
                </div>
              </div>

              <div className="activity-copy">
                <div className="attempt-status">
                  <span className={selectedChoice ? 'is-attempted' : ''}>
                    {selectedChoice ? <Check size={14} /> : <RotateCcw size={14} />}
                    {selectedChoice ? 'Activity attempted' : 'Attempt in progress'}
                  </span>
                </div>
                <p>{demo.activity.context}</p>
                <h1>{demo.activity.prompt}</h1>

                {supportRequest ? (
                  <div className={`support-response support-${supportRequest}`} role="status">
                    <strong>
                      {supportRequest === 'show' && 'Look at one choice at a time.'}
                      {supportRequest === 'help' && 'Think about where books wait before they are sorted.'}
                      {supportRequest === 'break' && 'Pause here. Your only step is to choose where the book goes first.'}
                    </strong>
                    <span>Your support request changes the presentation, not the learning goal.</span>
                  </div>
                ) : null}

                <div className="canonical-choices" role="group" aria-label="Choose the library process step">
                  {demo.activity.choices.map((choice, index) => {
                    const isSelected = choice.id === selectedChoiceId;
                    return (
                      <button
                        className={isSelected ? 'canonical-choice is-selected' : 'canonical-choice'}
                        type="button"
                        key={choice.id}
                        aria-pressed={isSelected}
                        onClick={() => onSelectChoice(choice.id)}
                        data-testid={`choice-${choice.id}`}
                      >
                        <span className="choice-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                        <span><strong>{choice.label}</strong><small>{choice.description}</small></span>
                        {isSelected ? <Check size={19} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>

                {selectedChoice ? (
                  <section className="choice-feedback" aria-live="polite" ref={feedbackRef} data-testid="choice-feedback">
                    <span>What this attempt shows</span>
                    <p>{feedbackForChoice(selectedChoice)}</p>
                    <small>This describes the activity response. It does not score you or decide whether this job fits you.</small>
                  </section>
                ) : null}
              </div>
            </article>
          </div>

          <aside className="support-panel" aria-labelledby="support-title">
            <span className="support-panel-number" aria-hidden="true">03</span>
            <h2 id="support-title">What would help right now?</h2>
            <p>Choose support whenever you need it. You can still make the activity choice yourself.</p>
            <div className="support-actions">
              {supportActions.map(({ request, label, description, icon: Icon }) => (
                <button
                  type="button"
                  key={request}
                  className={supportRequest === request ? 'is-selected' : ''}
                  aria-pressed={supportRequest === request}
                  onClick={() => onSupport(request)}
                  data-testid={`support-${request}`}
                >
                  <Icon size={21} aria-hidden="true" />
                  <span><strong>{label}</strong><small>{description}</small></span>
                  {supportRequest === request ? <Check size={17} aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
            <p className="support-privacy">Support is recorded only as part of this synthetic attempt.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
