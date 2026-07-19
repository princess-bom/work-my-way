import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  HandHelping,
  LoaderCircle,
  Mic,
  Pause,
  RotateCcw,
  Volume2
} from 'lucide-react';
import type { SupportPacketResponse } from '../../shared/support-schema';
import type { CanonicalChoiceId, SupportRequest } from './masteryDemo';

type LibraryLearningProps = {
  supportRequest: SupportRequest | null;
  supportPacket: SupportPacketResponse | null;
  loadingSupport: SupportRequest | null;
  selectedChoiceId: CanonicalChoiceId | null;
  onBack: () => void;
  onSupport: (request: SupportRequest) => void | Promise<void>;
  onSelectChoice: (choiceId: CanonicalChoiceId) => void | Promise<void>;
  onNext: () => void;
  onStartVoice: () => void;
  voiceLabel?: string;
  voicePending?: boolean;
  voiceActive?: boolean;
  voiceMessage?: string;
  persistenceLabel: string;
};

const choices = [
  {
    id: 'return-cart' as const,
    label: '반납 카트에 놓아요',
    image: '/assets/return-cart.avif',
    description: '돌아온 책을 한곳에 모아요.'
  },
  {
    id: 'shelf-now' as const,
    label: '바로 책장에 꽂아요',
    image: '/assets/shelf-label.avif',
    description: '라벨을 확인하기 전에 책장에 놓아요.'
  },
  {
    id: 'front-desk' as const,
    label: '책상에 그대로 두어요',
    image: '/assets/work-my-way-library-hero.png',
    description: '반납된 자리에 책을 남겨 두어요.'
  }
];

const supports = [
  { id: 'show' as const, label: '그림으로 볼래요', icon: Eye },
  { id: 'help' as const, label: '도와주세요', icon: HandHelping },
  { id: 'break' as const, label: '잠깐 쉴래요', icon: Pause }
];

function feedback(choiceId: CanonicalChoiceId) {
  if (choiceId === 'return-cart') return '좋아요. 반납된 책은 먼저 반납 카트에 모아요.';
  return '괜찮아요. 다시 살펴보면, 돌아온 책은 먼저 반납 카트에 모아요.';
}

export function LibraryLearning({
  supportRequest,
  supportPacket,
  loadingSupport,
  selectedChoiceId,
  onBack,
  onSupport,
  onSelectChoice,
  onNext,
  onStartVoice,
  voiceLabel = '이든과 말하기',
  voicePending = false,
  voiceActive = false,
  voiceMessage,
  persistenceLabel
}: LibraryLearningProps) {
  return (
    <main className="learning-screen">
      <header className="student-topbar learning-topbar">
        <button className="round-back" type="button" onClick={onBack} aria-label="직업 소개로 돌아가기"><ArrowLeft /></button>
        <div className="learning-title">
          <span>도서관 사서의 하루</span>
          <strong>반납된 책 정리하기</strong>
        </div>
        <div className="learning-progress" aria-label="학습 3회기 중 3회기">
          <span>3회기 · {persistenceLabel}</span>
          <div><i /><i /><i className="active" /></div>
        </div>
      </header>

      <section className="learning-layout">
        <article className="learning-scene">
          <img src="/assets/work-my-way-library-hero.png" alt="반납된 책과 책 카트가 있는 도서관 실습 장면" />
          <div className="learning-scene-caption">
            <span>03</span>
            <div><strong>반납된 책 정리하기</strong><p>반납된 책이 책상 위에 있어요.</p></div>
          </div>
        </article>

        <aside className="learning-panel">
          <div className="guide-row">
            <img src="/assets/eiden-speaking.avif" alt="학습 도우미 이든" />
            <div>
              <span>이든과 함께 살펴보기</span>
              <h1>반납된 책은<br />어디에 먼저 놓을까요?</h1>
              <button className="listen-button" type="button"><Volume2 /> 다시 듣기</button>
            </div>
          </div>

          <button className={voiceActive ? 'voice-button active' : 'voice-button'} type="button" onClick={onStartVoice} disabled={voicePending} aria-pressed={voiceActive}>
            {voicePending ? <LoaderCircle className="spin" /> : <Mic />}
            <span><strong>{voicePending ? '연결하고 있어요' : voiceLabel}</strong><small>말하기는 선택이에요. 아래 그림 버튼도 사용할 수 있어요.</small></span>
          </button>
          {voiceMessage ? <p className="voice-status" role="status">{voiceMessage}</p> : null}

          {supportRequest ? (
            <div className={`student-support-message support-${supportRequest}`} role="status" data-testid="support-response">
              {loadingSupport === supportRequest ? (
                <><LoaderCircle className="spin" /><strong>도움말을 준비하고 있어요.</strong></>
              ) : (
                <>
                  <Check />
                  <div>
                    <strong>{supportPacket?.studentMessage ?? '한 단계씩 천천히 살펴봐요.'}</strong>
                    <small>{supportPacket?.generation.mode === 'live' ? 'AI가 만든 도움말을 선생님이 확인할 수 있어요.' : '안전하게 준비된 도움말이에요.'}</small>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <div className="choice-heading">
            <span>그림으로 대답해도 괜찮아요</span>
            <p>하나를 눌러 주세요.</p>
          </div>

          <div className="picture-choice-grid" role="group" aria-label="반납된 책을 먼저 놓을 곳">
            {choices.map((choice) => {
              const selected = choice.id === selectedChoiceId;
              return (
                <button
                  key={choice.id}
                  type="button"
                  className={selected ? 'picture-choice selected' : 'picture-choice'}
                  onClick={() => onSelectChoice(choice.id)}
                  disabled={selectedChoiceId !== null && !selected}
                  aria-pressed={selected}
                  data-testid={`choice-${choice.id}`}
                >
                  <span className="picture-choice-image"><img src={choice.image} alt="" /></span>
                  <strong>{choice.label}</strong>
                  <small>{choice.description}</small>
                  {selected ? <Check className="choice-check" /> : null}
                </button>
              );
            })}
          </div>

          {selectedChoiceId ? (
            <div className={selectedChoiceId === 'return-cart' ? 'choice-result success' : 'choice-result'} role="status" data-testid="choice-feedback">
              <RotateCcw aria-hidden="true" />
              <strong>{feedback(selectedChoiceId)}</strong>
            </div>
          ) : null}

          <div className="student-support-actions" aria-label="도움 선택">
            {supports.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => onSupport(id)}
                disabled={loadingSupport !== null || selectedChoiceId !== null}
                className={supportRequest === id ? 'active' : ''}
                data-testid={`support-${id}`}
              >
                <Icon /> {label}
              </button>
            ))}
          </div>

          <button className="large-student-cta learning-next" type="button" onClick={onNext} disabled={!selectedChoiceId}>
            오늘 학습 정리하기 <ArrowRight />
          </button>
        </aside>
      </section>
    </main>
  );
}
