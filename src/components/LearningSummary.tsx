import { ArrowLeft, ArrowRight, CheckCircle2, Repeat2, Target } from 'lucide-react';
import type { CanonicalChoiceId } from './masteryDemo';

type LearningSummaryProps = {
  selectedChoiceId: CanonicalChoiceId | null;
  masteryStatus: 'in_progress' | 'ready_for_teacher_review' | 'mastered';
  onBack: () => void;
  onRecords: () => void;
  onRepeat: () => void;
};

export function LearningSummary({ selectedChoiceId, masteryStatus, onBack, onRecords, onRepeat }: LearningSummaryProps) {
  const criterionMet = selectedChoiceId === 'return-cart';
  const ready = masteryStatus === 'ready_for_teacher_review' || masteryStatus === 'mastered';

  return (
    <main className="simple-screen summary-screen">
      <button className="round-back" type="button" onClick={onBack} aria-label="학습 화면으로 돌아가기"><ArrowLeft /></button>
      <section className="summary-card">
        <div className="summary-eiden"><img src="/assets/eiden-wave.avif" alt="손을 흔드는 이든" /></div>
        <span className="step-kicker">오늘의 학습 정리</span>
        <h1>{criterionMet ? '반납된 책을 잘 정리했어요!' : '한 번 더 천천히 익혀봐요.'}</h1>
        <p>같은 목표를 여러 회기에 걸쳐 반복하면서 익혀 가요.</p>

        <div className="summary-goal-card">
          <Target />
          <div><span>나의 학습 목표</span><strong>책의 라벨을 확인하고 알맞은 반납 카트에 놓기</strong></div>
        </div>

        <div className="session-dots" aria-label="세 번의 학습 기록">
          <div className="session-dot"><span>1</span><small>도움과 함께</small></div>
          <i />
          <div className="session-dot success"><span><CheckCircle2 /></span><small>그림 도움</small></div>
          <i />
          <div className={criterionMet ? 'session-dot success' : 'session-dot'}><span>{criterionMet ? <CheckCircle2 /> : '3'}</span><small>오늘</small></div>
        </div>

        <div className={ready ? 'mastery-message ready' : 'mastery-message'}>
          <Repeat2 />
          <div>
            <strong>{ready ? '서로 다른 두 회기에서 목표 행동이 확인되었어요.' : '반복 연습 기록을 이어가고 있어요.'}</strong>
            <p>{ready ? '이제 선생님이 기록을 확인하면 숙달 여부가 확정돼요.' : '숙달은 한 번의 정답이 아니라 반복된 행동과 교사 확인으로 결정돼요.'}</p>
          </div>
        </div>

        <div className="summary-actions">
          <button type="button" onClick={onRepeat}><Repeat2 /> 다시 연습하기</button>
          <button className="large-student-cta" type="button" onClick={onRecords}>나의 기록 보기 <ArrowRight /></button>
        </div>
      </section>
    </main>
  );
}
