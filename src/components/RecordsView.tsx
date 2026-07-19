import { ArrowLeft, Check, GraduationCap, LockKeyhole, Repeat2, Target } from 'lucide-react';
import type { MasteryStatus, SupportLevel } from '../domain/mastery';

type RecordsViewProps = {
  masteryStatus: MasteryStatus;
  currentSupportLevel?: SupportLevel;
  onBack: () => void;
  onTeacher: () => void;
  onHome: () => void;
  persistenceLabel: string;
};

function supportLabel(level?: SupportLevel) {
  if (level === 'none') return '도움 없이 수행';
  if (level === 'visual_choice') return '그림 선택 도움';
  if (level === 'verbal_prompt') return '말로 한 번 도움';
  if (level === 'direct_model') return '직접 시범 도움';
  return '기록 전';
}

export function RecordsView({ masteryStatus, currentSupportLevel, onBack, onTeacher, onHome, persistenceLabel }: RecordsViewProps) {
  const ready = masteryStatus === 'ready_for_teacher_review';
  const mastered = masteryStatus === 'mastered';

  return (
    <main className="records-screen">
      <header className="student-topbar records-topbar">
        <button className="round-back" type="button" onClick={onBack} aria-label="학습 정리로 돌아가기"><ArrowLeft /></button>
        <div><span>나의 학습 기록</span><strong>도서관 사서 · 반납 도서 정리</strong></div>
        <button className="teacher-entry compact" type="button" onClick={onTeacher}><GraduationCap /> 선생님 확인</button>
      </header>

      <section className="records-layout">
        <aside className="records-goal">
          <span className="step-kicker">IEP 연계 가상 목표</span>
          <div className="records-goal-icon"><Target /></div>
          <h1>책의 라벨을 확인하고<br />알맞은 반납 카트에 놓기</h1>
          <p>관찰 가능한 같은 행동을 서로 다른 회기에서 반복해 확인해요.</p>
          <p className="persistence-note">저장 상태: {persistenceLabel}</p>
          <div className={`records-status ${mastered ? 'mastered' : ready ? 'ready' : ''}`}>
            {mastered ? <Check /> : <Repeat2 />}
            <span><small>현재 상태</small><strong>{mastered ? '교사 확인 완료' : ready ? '교사 확인 준비' : '반복 학습 중'}</strong></span>
          </div>
          <button type="button" onClick={onHome}>다른 직업 둘러보기</button>
        </aside>

        <section className="records-timeline" aria-label="학습 회기 기록">
          <div className="record-item">
            <span className="record-number">1</span>
            <article><header><strong>1회기 · 반납대 살펴보기</strong><small>이전 학습</small></header><p>다른 위치를 선택하여 수업을 계속했어요.</p><span>말로 한 번 도움</span></article>
          </div>
          <div className="record-item qualifying">
            <span className="record-number"><Check /></span>
            <article><header><strong>2회기 · 책 라벨 비교하기</strong><small>이전 학습</small></header><p>반납 카트를 선택하여 목표 행동이 관찰되었어요.</p><span>그림 선택 도움</span></article>
          </div>
          <div className={`record-item current ${currentSupportLevel === 'visual_choice' || currentSupportLevel === 'none' ? 'qualifying' : ''}`}>
            <span className="record-number">3</span>
            <article><header><strong>3회기 · 반납된 책 정리하기</strong><small>오늘</small></header><p>학생이 선택한 행동과 사용한 도움 수준을 그대로 기록했어요.</p><span>{supportLabel(currentSupportLevel)}</span></article>
          </div>
          <div className="record-item future">
            <span className="record-number"><LockKeyhole /></span>
            <article><header><strong>직업 면접 연습</strong><small>미래 단계</small></header><p>직업 탐구 학습이 충분히 숙달된 뒤 연결되는 과정이에요. 이번 MVP에는 포함되지 않아요.</p></article>
          </div>
        </section>
      </section>
    </main>
  );
}
