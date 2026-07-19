import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  FileCheck2,
  LayoutDashboard,
  PencilLine,
  ShieldCheck,
  Sparkles,
  UsersRound
} from 'lucide-react';
import type { SupportPacketResponse } from '../../shared/support-schema';
import { syntheticLearners } from '../data/demo';
import { BrandMark } from './BrandMark';
import { ModeBadge } from './ModeBadge';

type TeacherConsoleProps = {
  packet: SupportPacketResponse | null;
  confirmed: boolean;
  onConfirm: () => void;
  onBack: () => void;
};

const illustrativePacket: SupportPacketResponse = {
  studentMessage: 'Let’s make this one step smaller.',
  studentChoices: [
    { label: 'Check the return cart', visualCue: 'A cart holding returned books' },
    { label: 'Match the shelf label', visualCue: 'A book beside a shelf label' }
  ],
  recommendedSupport: 'visual_choices',
  teacherSignal: 'explicit_visual_request',
  teacherSummary: 'The learner explicitly asked to see the Library Assistant scene with visual choices.',
  teacherNextStep: 'Review the scene with two visual choices.',
  evidence: 'Based only on the learner’s explicit support request in this scene.',
  safety: { noScoring: true, noDiagnosis: true, teacherReviewRequired: true },
  generation: {
    mode: 'illustrative-sample',
    model: 'gpt-5.6-luna',
    latencyMs: 0,
    reason: 'Sample shown until the student requests support.'
  }
};

export function TeacherConsole({ packet, confirmed, onConfirm, onBack }: TeacherConsoleProps) {
  const activePacket = packet ?? illustrativePacket;
  const [summary, setSummary] = useState(activePacket.teacherSummary);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setSummary(activePacket.teacherSummary);
  }, [activePacket.teacherSummary]);

  return (
    <main className="teacher-shell">
      <aside className="teacher-sidebar">
        <BrandMark />
        <nav aria-label="Teacher navigation">
          <button type="button"><LayoutDashboard size={19} /> Overview</button>
          <button className="active" type="button"><FileCheck2 size={19} /> Review queue <span>3</span></button>
          <button type="button"><UsersRound size={19} /> Learners</button>
        </nav>
        <div className="teacher-profile">
          <CircleUserRound size={34} />
          <span><strong>Demo Teacher</strong><small>Educator workspace</small></span>
        </div>
      </aside>

      <section className="teacher-workspace">
        <header className="teacher-header">
          <button className="back-button" type="button" onClick={onBack}>
            <ArrowLeft size={17} /> Student experience
          </button>
          <div>
            <span className="eyebrow">Teacher workspace</span>
            <h1>Review support drafts</h1>
            <p>Confirm the facts before anything becomes a learning note.</p>
          </div>
        </header>

        <div className="review-layout">
          <section className="review-queue" aria-label="Synthetic learner review queue">
            <div className="queue-heading">
              <h2>Needs review</h2>
              <span>3</span>
            </div>
            <p className="synthetic-label">Synthetic demo records</p>
            {syntheticLearners.map((learner, index) => (
              <button className={`learner-row ${learner.active ? 'active' : ''}`} type="button" key={learner.name}>
                <span className={`avatar tone-${index}`}>{learner.initials}</span>
                <span className="learner-copy">
                  <strong>{learner.name}</strong>
                  <small>{learner.scene}</small>
                  <small><Clock3 size={12} /> {learner.time}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </section>

          <section className="review-detail">
            <div className="review-titlebar">
              <div>
                <span className="eyebrow">Alex M. · Library Assistant</span>
                <h2>Adaptive support draft</h2>
              </div>
              <ModeBadge generation={activePacket.generation} />
            </div>

            <div className="evidence-strip">
              <ShieldCheck size={20} />
              <p><strong>Evidence boundary</strong><br />{activePacket.evidence}</p>
            </div>

            <div className="teacher-card-grid">
              <article className="teacher-draft-card">
                <span className="card-kicker"><Sparkles size={15} /> Student support shown</span>
                <blockquote>“{activePacket.studentMessage}”</blockquote>
                <ul>
                  {activePacket.studentChoices.map((choice) => (
                    <li key={choice.label}><Check size={14} /> {choice.label}</li>
                  ))}
                </ul>
              </article>

              <article className="teacher-draft-card">
                <span className="card-kicker"><FileCheck2 size={15} /> Suggested next step</span>
                <p>{activePacket.teacherNextStep}</p>
                <div className="safety-list">
                  <span><Check size={13} /> No scoring</span>
                  <span><Check size={13} /> No diagnosis</span>
                  <span><Check size={13} /> Teacher approval</span>
                </div>
              </article>
            </div>

            <label className="summary-field">
              <span>Draft learning note</span>
              <textarea
                readOnly={!editing}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </label>

            <div className="review-actions">
              <button className="secondary-action" type="button" onClick={() => setEditing((value) => !value)}>
                <PencilLine size={17} /> {editing ? 'Finish editing' : 'Edit suggestion'}
              </button>
              <button
                className={`primary-action ${confirmed ? 'confirmed' : ''}`}
                type="button"
                onClick={onConfirm}
                disabled={confirmed}
                data-testid="confirm-note"
              >
                <FileCheck2 size={18} /> {confirmed ? 'Learning note confirmed' : 'Confirm learning note'}
              </button>
            </div>

            <p className="teacher-disclaimer">
              GPT-5.6 drafts support language. The educator decides what is accurate, appropriate, and worth keeping.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
