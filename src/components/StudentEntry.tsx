import { ArrowLeft, ArrowRight, UserRound } from 'lucide-react';

type StudentEntryProps = {
  onBack: () => void;
  onEnter: () => void;
};

export function StudentEntry({ onBack, onEnter }: StudentEntryProps) {
  return (
    <main className="simple-screen student-entry-screen">
      <button className="round-back" type="button" onClick={onBack} aria-label="직업 선택으로 돌아가기"><ArrowLeft /></button>
      <section className="simple-card student-entry-card">
        <span className="step-kicker">나의 직업 탐색</span>
        <div className="student-entry-avatar" aria-hidden="true"><UserRound /></div>
        <h1>민준 학생, 안녕하세요!</h1>
        <p>오늘은 도서관 사서가 하는 일을 천천히 살펴볼 거예요.</p>
        <button className="large-student-cta" type="button" onClick={onEnter}>
          시작하기 <ArrowRight />
        </button>
        <small>이 화면의 학생과 기록은 심사용 가상 데이터입니다.</small>
      </section>
    </main>
  );
}
