import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  FileCheck2,
  Flag,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  Target,
  UsersRound
} from 'lucide-react';
import {
  feedbackForChoice,
  supportLevelLabel,
  supportLabel,
  type CanonicalChoiceId,
  type MasteryDemoViewModel,
  type MasterySession,
  type SupportRequest
} from './masteryDemo';
import { BrandMark } from './BrandMark';
import type { MasteryStatus, SupportLevel } from '../domain/mastery';
import type { SupportPacketResponse } from '../../shared/support-schema';

type TeacherConsoleProps = {
  demo: MasteryDemoViewModel;
  supportRequest: SupportRequest | null;
  supportPacket: SupportPacketResponse | null;
  currentSupportLevel: SupportLevel | undefined;
  selectedChoiceId: CanonicalChoiceId | null;
  masteryStatus: MasteryStatus;
  onConfirm: () => void;
  onBack: () => void;
};

function SessionTimelineItem({ session }: { session: MasterySession }) {
  return (
    <li className="timeline-item">
      <span className="timeline-marker"><Check size={14} strokeWidth={3} /></span>
      <article>
        <div className="timeline-heading">
          <span>{session.label}</span>
          <small>{session.dateLabel}</small>
        </div>
        <h3>{session.activity}</h3>
        <dl>
          <div><dt>Support level</dt><dd>{session.supportLevel}</dd></div>
          <div><dt>Mastery evidence</dt><dd>{session.evidence}</dd></div>
        </dl>
      </article>
    </li>
  );
}

export function TeacherConsole({
  demo,
  supportRequest,
  supportPacket,
  currentSupportLevel,
  selectedChoiceId,
  masteryStatus,
  onConfirm,
  onBack
}: TeacherConsoleProps) {
  const selectedChoice = demo.activity.choices.find((choice) => choice.id === selectedChoiceId) ?? null;
  const currentEvidence = selectedChoice
    ? feedbackForChoice(selectedChoice)
    : 'No activity choice has been submitted yet. The current attempt remains in progress.';
  const teacherReviewReady = masteryStatus === 'ready_for_teacher_review';
  const confirmed = masteryStatus === 'mastered';
  const statusLabel = confirmed
    ? 'Teacher confirmed'
    : teacherReviewReady
      ? 'Ready for teacher review'
      : selectedChoice ? 'Instruction continues' : 'In progress';
  const currentSupportLabel = currentSupportLevel
    ? supportLevelLabel(currentSupportLevel)
    : supportLabel(supportRequest);

  return (
    <main className="teacher-shell">
      <aside className="teacher-sidebar">
        <BrandMark />
        <nav aria-label="Teacher navigation">
          <button type="button"><LayoutDashboard size={19} /> Overview</button>
          <button className="active" type="button"><ClipboardCheck size={19} /> Mastery review <span>1</span></button>
          <button type="button"><UsersRound size={19} /> Learners</button>
        </nav>
        <div className="teacher-profile">
          <span className="teacher-avatar">DT</span>
          <span><strong>Demo Teacher</strong><small>Educator evaluator view</small></span>
        </div>
      </aside>

      <section className="teacher-workspace">
        <div className="evaluator-banner teacher-evaluator-banner" role="note">
          <strong>Synthetic demonstration</strong>
          <span>Adult evaluator view · No real learner record, diagnosis, or job suitability score</span>
        </div>

        <header className="teacher-header">
          <button className="back-button" type="button" onClick={onBack}>
            <ArrowLeft size={17} /> Student activity
          </button>
          <div>
            <span className="eyebrow">Mastery evidence</span>
            <h1>{demo.learner.name} · Learning timeline</h1>
            <p>Review the synthetic activity evidence and confirm only what is visible in the attempt.</p>
          </div>
        </header>

        <div className="teacher-dashboard">
          <aside className="learner-summary" aria-label="Synthetic learner summary">
            <div className="learner-summary-title">
              <span className="learner-avatar large">{demo.learner.initials}</span>
              <div><small>Synthetic learner</small><h2>{demo.learner.name}</h2></div>
            </div>
            <section>
              <span><Target size={16} /> My learning goal</span>
              <p>{demo.learningGoal}</p>
            </section>
            <dl className="summary-metrics">
              <div><dt>Sessions shown</dt><dd>3</dd></div>
              <div><dt>Current status</dt><dd>{statusLabel}</dd></div>
              <div><dt>Support in session 3</dt><dd>{currentSupportLabel}</dd></div>
            </dl>
            <div className="safety-boundary">
              <ShieldCheck size={18} />
              <p><strong>Evidence boundary</strong>Only actions in this synthetic activity appear here.</p>
            </div>
          </aside>

          <section className="timeline-panel" aria-labelledby="timeline-title">
            <div className="timeline-titlebar">
              <div><span className="eyebrow">Three-session view</span><h2 id="timeline-title">Progress toward the learning goal</h2></div>
              <span className="attempted-badge">{selectedChoice ? 'Activity attempted' : 'Attempt in progress'}</span>
            </div>

            <ol className="mastery-timeline">
              {demo.previousSessions.map((session) => <SessionTimelineItem key={session.id} session={session} />)}
              <li className="timeline-item is-current">
                <span className="timeline-marker">3</span>
                <article>
                  <div className="timeline-heading"><span>Session 3</span><small>Current attempt</small></div>
                  <h3>{demo.activity.title} · {demo.activity.prompt}</h3>
                  <dl>
                    <div><dt>Support level</dt><dd>{currentSupportLabel}</dd></div>
                    <div><dt>Mastery evidence</dt><dd>{currentEvidence}</dd></div>
                  </dl>
                  <div className="evidence-facts" aria-label="Evidence safeguards">
                    <span><Check size={13} /> Activity response only</span>
                    <span><Check size={13} /> No learner scoring</span>
                    <span><Check size={13} /> No job-fit judgment</span>
                  </div>
                  {supportPacket ? (
                    <section className="model-support-note" aria-label="GPT-5.6 support draft">
                      <span>Support draft for teacher review</span>
                      <p>{supportPacket.teacherSummary}</p>
                      <small>
                        {supportPacket.generation.mode === 'live'
                          ? 'Live GPT-5.6 support packet; mastery remains deterministic and teacher confirmed.'
                          : 'Safe fallback support packet; mastery remains deterministic and teacher confirmed.'}
                      </small>
                    </section>
                  ) : null}
                </article>
              </li>
              <li className="timeline-item is-future">
                <span className="timeline-marker"><LockKeyhole size={14} /></span>
                <article>
                  <div className="timeline-heading"><span>Future phase</span><small>Locked</small></div>
                  <h3>{demo.futureStage.title}</h3>
                  <p>{demo.futureStage.description}. There is no interview interaction in this demo.</p>
                </article>
              </li>
            </ol>

            <footer className="teacher-confirmation">
              <div>
                <span><Flag size={17} /> Teacher-only checkpoint</span>
                <p>
                  {confirmed
                    ? 'The teacher confirmed the qualifying synthetic evidence.'
                    : teacherReviewReady
                      ? 'Confirm the two qualifying attempts from different sessions.'
                      : 'A qualifying two-session evidence pattern is required before confirmation.'}
                </p>
              </div>
              <button
                className={confirmed ? 'primary-action confirmed' : 'primary-action'}
                type="button"
                onClick={onConfirm}
                disabled={confirmed || !teacherReviewReady}
                data-testid="confirm-evidence"
              >
                <FileCheck2 size={18} /> {confirmed ? 'Evidence confirmed' : 'Confirm qualifying evidence'}
              </button>
            </footer>
          </section>
        </div>
      </section>
    </main>
  );
}
