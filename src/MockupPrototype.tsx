import type { JobId, ViewId } from './domain';
import { MockupThreeOverlay } from './MockupThreeOverlay';

type MockupPrototypeProps = {
  view: ViewId;
  selectedJobId: JobId;
  onStart: () => void;
  onChooseJob: (jobId: JobId) => void;
  onJobSession: () => void;
  onSummary: () => void;
  onSave: () => void;
  onRecords: () => void;
  onTeacher: () => void;
  onHome: () => void;
  onOtherJob: () => void;
  onSupport: (action: 'replay' | 'visual' | 'help' | 'pause') => void;
};

const backgrounds: Record<ViewId, string> = {
  landing: '/mockups/revised-landing-mockup.png',
  path: '/mockups/revised-landing-mockup.png',
  intro: '/mockups/third-page-job-session-mockup.png',
  day: '/mockups/third-page-job-session-mockup.png',
  summary: '/mockups/fifth-page-summary-mockup.png',
  saved: '/mockups/sixth-page-save-complete-mockup.png',
  records: '/mockups/my-records-page-mockup.png',
  teacher: '/mockups/teacher-dashboard-mockup.png'
};

export function MockupPrototype({
  view,
  selectedJobId,
  onStart,
  onChooseJob,
  onJobSession,
  onSummary,
  onSave,
  onRecords,
  onTeacher,
  onHome,
  onOtherJob,
  onSupport
}: MockupPrototypeProps) {
  const src = backgrounds[view];
  return (
    <section className={`mockup-prototype mockup-view-${view}`} aria-label="목업 기준 데스크톱 프로토타입">
      <img className="mockup-bg" src={src} alt="" draggable={false} />
      {view === 'landing' && (
        <>
          <Hotspot label="시작하기" className="spot-landing-start" onClick={onStart} />
          <Hotspot label="교사용으로 보기" className="spot-landing-teacher" onClick={onTeacher} />
        </>
      )}

      {view === 'path' && (
        <>
          <MockupThreeOverlay selectedJobId={selectedJobId} onSelectJob={onChooseJob} />
          <Hotspot label="카페 바리스타 선택" className="spot-map-cafe" onClick={() => onChooseJob('barista-aide')} />
          <Hotspot label="도서관 사서 선택" className="spot-map-library" onClick={() => onChooseJob('library-aide')} />
          <Hotspot label="제빵사 선택" className="spot-map-baker" onClick={() => onChooseJob('baker-aide')} />
          <Hotspot label="선택한 직업 탐색하기" className="spot-map-continue" onClick={onJobSession} />
          <Hotspot label="교사용으로 보기" className="spot-landing-teacher" onClick={onTeacher} />
        </>
      )}

      {(view === 'intro' || view === 'day') && (
        <>
          <Hotspot label="뒤로" className="spot-session-back" onClick={onOtherJob} />
          <Hotspot label="교사 보기" className="spot-session-teacher" onClick={onTeacher} />
          <Hotspot label="책 정리" className="spot-choice-one" onClick={onSummary} />
          <Hotspot label="이용자 안내" className="spot-choice-two" onClick={onSummary} />
          <Hotspot label="조용히 일하기" className="spot-choice-three" onClick={onSummary} />
          <Hotspot label="다시 듣기" className="spot-support-replay" onClick={() => onSupport('replay')} />
          <Hotspot label="그림으로 보기" className="spot-support-visual" onClick={() => onSupport('visual')} />
          <Hotspot label="도움 요청" className="spot-support-help" onClick={() => onSupport('help')} />
          <Hotspot label="잠깐 쉬기" className="spot-support-pause" onClick={() => onSupport('pause')} />
          <Hotspot label="오늘의 탐색 정리로 이동" className="spot-session-next" onClick={onSummary} />
        </>
      )}

      {view === 'summary' && (
        <>
          <Hotspot label="뒤로" className="spot-summary-back" onClick={() => onJobSession()} />
          <Hotspot label="교사 보기" className="spot-summary-teacher" onClick={onTeacher} />
          <Hotspot label="준비하기" className="spot-summary-scene-one" onClick={() => undefined} />
          <Hotspot label="손님 맞이" className="spot-summary-scene-two" onClick={() => undefined} />
          <Hotspot label="음료 만들기" className="spot-summary-scene-three" onClick={() => undefined} />
          <Hotspot label="정리하기" className="spot-summary-scene-four" onClick={() => undefined} />
          <Hotspot label="해보고 싶어요" className="spot-thought-one" onClick={() => undefined} />
          <Hotspot label="조금 어려웠어요" className="spot-thought-two" onClick={() => undefined} />
          <Hotspot label="더 알아볼래요" className="spot-thought-three" onClick={() => undefined} />
          <Hotspot label="기록 저장하기" className="spot-save-record" onClick={onSave} />
          <Hotspot label="다른 직업 보기" className="spot-summary-other" onClick={onOtherJob} />
        </>
      )}

      {view === 'saved' && (
        <>
          <Hotspot label="뒤로" className="spot-saved-back" onClick={() => onSummary()} />
          <Hotspot label="교사 보기" className="spot-saved-teacher" onClick={onTeacher} />
          <Hotspot label="다른 직업 보기" className="spot-saved-other" onClick={onOtherJob} />
          <Hotspot label="내 기록 보기" className="spot-saved-records" onClick={onRecords} />
          <Hotspot label="처음으로" className="spot-saved-home" onClick={onHome} />
        </>
      )}

      {view === 'records' && (
        <>
          <Hotspot label="뒤로" className="spot-records-back" onClick={() => onHome()} />
          <Hotspot label="교사 보기" className="spot-records-teacher" onClick={onTeacher} />
          <Hotspot label="바리스타 다시 보기" className="spot-records-first" onClick={() => onJobSession()} />
          <Hotspot label="도서관 사서 아직 정리 전" className="spot-records-second" onClick={() => onJobSession()} />
          <Hotspot label="제빵사 다음에 보기" className="spot-records-third" onClick={() => onOtherJob()} />
          <Hotspot label="다른 직업 보기" className="spot-records-other" onClick={onOtherJob} />
          <Hotspot label="처음으로" className="spot-records-home" onClick={onHome} />
        </>
      )}

      {view === 'teacher' && (
        <>
          <Hotspot label="확인할 기록" className="spot-teacher-pending" onClick={() => undefined} />
          <Hotspot label="대화 기록" className="spot-teacher-dialogue" onClick={() => undefined} />
          <Hotspot label="지원 필요" className="spot-teacher-support" onClick={() => undefined} />
          <Hotspot label="교사 확인" className="spot-teacher-confirm" onClick={() => undefined} />
          <Hotspot label="자세히 보기" className="spot-teacher-detail" onClick={() => undefined} />
          <Hotspot label="학생 화면으로" className="spot-teacher-student" onClick={onHome} />
        </>
      )}
    </section>
  );
}

function Hotspot({
  label,
  className,
  onClick
}: {
  label: string;
  className: string;
  onClick: () => void;
}) {
  return <button className={`mockup-hotspot ${className}`} type="button" aria-label={label} onClick={onClick} />;
}
