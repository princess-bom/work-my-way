import {
  Ear,
  ImageIcon,
  Pause,
  Users
} from 'lucide-react';
import type { SupportActionId } from './domain';

export function SupportActionBar({
  replaying,
  onSupport
}: {
  replaying: boolean;
  onSupport: (action: SupportActionId) => void;
}) {
  return (
    <nav className="support-bar" aria-label="학생 지원 행동">
      <div className="support-dock">
        <button
          type="button"
          className={replaying ? 'support-action-talk active' : 'support-action-talk'}
          aria-label="장면 설명 다시 듣기"
          aria-pressed={replaying}
          onClick={() => onSupport('replay')}
        >
          <Ear size={26} />
          <span className="support-action-label">다시 듣기</span>
        </button>
        <button
          type="button"
          className="support-action-help"
          aria-label="선생님 호출"
          onClick={() => onSupport('help')}
        >
          <Users size={26} />
          <span className="support-action-label">선생님 호출</span>
        </button>
        <button
          type="button"
          className="support-action-visual"
          aria-label="그림으로 보기"
          onClick={() => onSupport('visual')}
        >
          <ImageIcon size={26} />
          <span className="support-action-label">그림 보기</span>
        </button>
        <button
          type="button"
          className="support-action-pause"
          aria-label="잠깐 쉬기"
          onClick={() => onSupport('pause')}
        >
          <Pause size={26} />
          <span className="support-action-label">쉬고 싶어요</span>
        </button>
      </div>
    </nav>
  );
}
