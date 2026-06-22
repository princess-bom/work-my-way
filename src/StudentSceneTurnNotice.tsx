import { HeartHandshake } from 'lucide-react';

export function SceneTurnResponseStatus({
  coachReply,
  helpNoticeOpen
}: {
  coachReply: string | null;
  helpNoticeOpen: boolean;
}) {
  return (
    <>
      {coachReply && (
        <p className="coach-reply" role="status" aria-live="polite">
          {coachReply}
        </p>
      )}
      {helpNoticeOpen && <HelpRequestNotice />}
    </>
  );
}

export function SceneStatusNote({
  statusText,
  fallbackText
}: {
  statusText: string;
  fallbackText: string;
}) {
  return (
    <p className="scene-status-note" role="status" aria-live="polite">
      {statusText} {fallbackText}
    </p>
  );
}

function HelpRequestNotice() {
  return (
    <aside className="support-confirmation" role="status" aria-live="polite">
      <HeartHandshake size={22} />
      <div>
        <strong>선생님께 알려드렸어요.</strong>
        <p>이 화면에서 잠시 기다려 주세요.</p>
      </div>
    </aside>
  );
}
