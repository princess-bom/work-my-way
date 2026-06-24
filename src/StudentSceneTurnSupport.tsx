import {
  Ear,
  ImageIcon,
  Mic,
  MicOff,
  Pause,
  Users
} from 'lucide-react';
import type { SupportActionId } from './domain';

export function SupportActionBar({
  replaying,
  realtimeAvailable = false,
  realtimeActive = false,
  realtimePending = false,
  onRealtimeToggle,
  onSupport
}: {
  replaying: boolean;
  realtimeAvailable?: boolean;
  realtimeActive?: boolean;
  realtimePending?: boolean;
  onRealtimeToggle?: () => void;
  onSupport: (action: SupportActionId) => void;
}) {
  return (
    <nav className="support-bar" aria-label="학생 지원 행동">
      <div className="support-dock">
        {realtimeAvailable && onRealtimeToggle && (
          <button
            type="button"
            className={realtimeActive ? 'support-action-realtime active' : 'support-action-realtime'}
            aria-label={realtimeActive ? '이든 실시간 대화 끄기' : '이든 실시간 대화 켜기'}
            aria-pressed={realtimeActive}
            disabled={realtimePending}
            onClick={onRealtimeToggle}
          >
            {realtimeActive ? <MicOff size={26} /> : <Mic size={26} />}
            <span className="support-action-label">{realtimePending ? '연결 중' : realtimeActive ? '대화 중' : '말하기'}</span>
          </button>
        )}
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
