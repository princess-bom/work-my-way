import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Coffee,
  Eye,
  Hand,
  Headphones,
  LoaderCircle,
  Pause,
  Sparkles,
  Volume2
} from 'lucide-react';
import type { SupportAction, SupportPacketResponse } from '../../shared/support-schema';
import { explorationSteps, libraryScene } from '../data/demo';
import { ModeBadge } from './ModeBadge';

type StudentExperienceProps = {
  packet: SupportPacketResponse | null;
  loadingAction: SupportAction | null;
  onSupport: (action: SupportAction) => void;
  onOpenTeacher: () => void;
};

const supportActions = [
  { action: 'visual' as const, label: 'Show me', icon: Eye },
  { action: 'help' as const, label: 'I need help', icon: Hand },
  { action: 'pause' as const, label: 'Take a break', icon: Pause }
];

export function StudentExperience({
  packet,
  loadingAction,
  onSupport,
  onOpenTeacher
}: StudentExperienceProps) {
  const adaptationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!packet || !window.matchMedia('(max-width: 660px)').matches) return;
    const timer = window.setTimeout(() => {
      adaptationRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [packet]);

  function speak() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(
      new SpeechSynthesisUtterance(packet?.studentMessage ?? libraryScene.question)
    );
  }

  return (
    <main className="student-shell">
      <aside className="student-sidebar" aria-label="Exploration progress">
        <div>
          <span className="eyebrow light">Today’s exploration</span>
          <h2>Library Assistant</h2>
          <p>Try a real work moment at your own pace.</p>
        </div>

        <ol className="step-list">
          {explorationSteps.map((step, index) => (
            <li key={step.label} className={`step-${step.state}`}>
              <span className="step-dot" aria-hidden="true">
                {step.state === 'done' ? <Check size={13} strokeWidth={3} /> : index + 1}
              </span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>

        <div className="pace-note">
          <Headphones size={18} />
          <p><strong>Your pace is okay.</strong><br />Ask for support at any time.</p>
        </div>
      </aside>

      <section className="student-workspace">
        <div className="workspace-topline">
          <div className="scene-label">
            <BookOpen size={18} />
            Scene 1 of 2 · Returning a book
          </div>
          <button className="teacher-link" type="button" onClick={onOpenTeacher}>
            Teacher view <ArrowRight size={16} />
          </button>
        </div>

        <div className="scene-grid">
          <div className="scene-visual">
            <img src="/assets/library-diorama.avif" alt="A friendly illustrated library desk and bookshelves" />
            <span className="scene-pill"><Coffee size={14} /> Work scene</span>
          </div>

          <div className="scene-copy">
            <span className="eyebrow">Try a work moment</span>
            <h1>{libraryScene.question}</h1>
            <p>{libraryScene.description} Take a moment, then choose the first step.</p>
            <button className="listen-button" type="button" onClick={speak}>
              <Volume2 size={18} /> Hear the question
            </button>
          </div>
        </div>

        {packet ? (
          <section
            className="adaptation-card"
            aria-live="polite"
            data-testid="adaptation-card"
            ref={adaptationRef}
          >
            <div className="adaptation-guide">
              <img src="/assets/eiden-speaking.avif" alt="Eiden, a friendly learning guide" />
              <span className="spark-dot"><Sparkles size={14} /></span>
            </div>
            <div className="adaptation-content">
              <div className="adaptation-heading">
                <div>
                  <span className="eyebrow">A smaller next step</span>
                  <h2>{packet.studentMessage}</h2>
                </div>
                <ModeBadge generation={packet.generation} />
              </div>

              <div className="choice-grid">
                {packet.studentChoices.map((choice, index) => (
                  <button className="choice-card" type="button" key={choice.label}>
                    {packet.recommendedSupport === 'visual_choices' && (
                      <img
                        src={index === 0 ? '/assets/return-cart.avif' : '/assets/shelf-label.avif'}
                        alt=""
                      />
                    )}
                    <span>
                      <strong>{choice.label}</strong>
                      <small>{choice.visualCue}</small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>

              <p className="student-privacy-note">
                This support responds only to what you asked for in this scene.
              </p>
            </div>
          </section>
        ) : (
          <section className="choice-prompt">
            <span className="prompt-number">1</span>
            <div>
              <h2>Choose your first step.</h2>
              <p>You can ask to see the choices before answering.</p>
            </div>
            <ArrowRight className="prompt-arrow" size={22} />
          </section>
        )}

        <nav className="support-rail" aria-label="Learning support">
          <button type="button" onClick={speak}>
            <Volume2 size={20} />
            <span>Hear it again</span>
          </button>
          {supportActions.map(({ action, label, icon: Icon }) => (
            <button
              type="button"
              key={action}
              className={packet?.teacherSignal.includes(action === 'visual' ? 'visual' : action) ? 'is-selected' : ''}
              disabled={loadingAction !== null}
              onClick={() => onSupport(action)}
              data-testid={`support-${action}`}
            >
              {loadingAction === action ? <LoaderCircle className="spin" size={20} /> : <Icon size={20} />}
              <span>{loadingAction === action ? 'Preparing…' : label}</span>
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}
