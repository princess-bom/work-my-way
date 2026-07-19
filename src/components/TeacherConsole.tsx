import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  FileCheck2,
  Flag,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  Target,
  UsersRound
} from 'lucide-react';
import {
  feedbackForChoice,
  supportLevelLabel,
  supportLabel,
  type CanonicalChoiceId,
  type MasteryDemoViewModel,
  type MasterySession,
  type SupportRequest
} from './masteryDemo';
import { BrandMark } from './BrandMark';
import type { MasteryStatus, SupportLevel } from '../domain/mastery';
import type { SupportPacketResponse } from '../../shared/support-schema';

type TeacherConsoleProps = {
  demo: MasteryDemoViewModel;
  supportRequest: SupportRequest | null;
  supportPacket: SupportPacketResponse | null;
  currentSupportLevel: SupportLevel | undefined;
  selectedChoiceId: CanonicalChoiceId | null;
  masteryStatus: MasteryStatus;
  onConfirm: () => void;
  onBack: () => void;
  onReset: () => void;
};

function SessionTimelineItem({ session }: { session: MasterySession }) {
  return (
    <li className="timeline-item">
      <span className="timeline-marker"><Check size={14} strokeWidth={3} /></span>
      <article>
        <div className="timeline-heading">
          <span>{session.label}</span>
          <small>{session.dateLabel}</small>
        </div>
        <h3>{session.activity}</h3>
        <dl>
          <div><dt>사용한 도움</dt><dd>{session.supportLevel}</dd></div>
          <div><dt>관찰 기록</dt><dd>{session.evidence}</dd></div>
        </dl>
      </article>
    </li>
  );
}

export function TeacherConsole({
  demo,
  supportRequest,
  supportPacket,
  currentSupportLevel,
  selectedChoiceId,
  masteryStatus,
  onConfirm,
  onBack,
  onReset
}: TeacherConsoleProps) {
  const selectedChoice = demo.activity.choices.find((choice) => choice.id === selectedChoiceId) ?? null;
  const currentEvidence = selectedChoice
    ? feedbackForChoice(selectedChoice)
    : '아직 선택한 행동이 없습니다. 현재 회기는 진행 중입니다.';
  const teacherReviewReady = masteryStatus === 'ready_for_teacher_review';
  const confirmed = masteryStatus === 'mastered';
  const statusLabel = confirmed
    ? '교사 확인 완료'
    : teacherReviewReady
      ? '교사 확인 준비'
      : selectedChoice ? '수업 계속' : '진행 중';
  const currentSupportLabel = currentSupportLevel
    ? supportLevelLabel(currentSupportLevel)
    : supportLabel(supportRequest);

  return (
    <main className="teacher-shell">
      <aside className="teacher-sidebar">
        <BrandMark />
        <nav aria-label="교사용 메뉴">
          <button type="button"><LayoutDashboard size={19} /> 전체 보기</button>
          <button className="active" type="button"><ClipboardCheck size={19} /> 숙달 확인 <span>1</span></button>
          <button type="button"><UsersRound size={19} /> 학생</button>
        </nav>
        <div className="teacher-profile">
          <span className="teacher-avatar">DT</span>
          <span><strong>데모 교사</strong><small>교사용 가상 기록</small></span>
        </div>
      </aside>

      <section className="teacher-workspace">
        <div className="evaluator-banner teacher-evaluator-banner" role="note">
          <strong>가상 데이터 시연</strong>
          <span>성인 심사자용 · 실제 학생 기록, 진단, 직업 적합성 점수를 사용하지 않습니다.</span>
        </div>

        <header className="teacher-header">
          <button className="back-button" type="button" onClick={onBack}>
            <ArrowLeft size={17} /> 학생 화면
          </button>
          <button className="reset-demo" type="button" onClick={onReset} data-testid="reset-demo">가상 기록 초기화</button>
          <div>
            <span className="eyebrow">숙달학습 관찰 기록</span>
            <h1>{demo.learner.name} · 학습 기록</h1>
            <p>가상 활동에 기록된 행동과 도움 수준만 확인합니다.</p>
          </div>
        </header>

        <div className="teacher-dashboard">
          <aside className="learner-summary" aria-label="가상 학생 요약">
            <div className="learner-summary-title">
              <span className="learner-avatar large">{demo.learner.initials}</span>
              <div><small>가상 학생</small><h2>{demo.learner.name}</h2></div>
            </div>
            <section>
              <span><Target size={16} /> IEP 연계 가상 목표</span>
              <p>{demo.learningGoal}</p>
            </section>
            <dl className="summary-metrics">
              <div><dt>학습 회기</dt><dd>3회</dd></div>
              <div><dt>현재 상태</dt><dd>{statusLabel}</dd></div>
              <div><dt>3회기 도움 수준</dt><dd>{currentSupportLabel}</dd></div>
            </dl>
            <div className="safety-boundary">
              <ShieldCheck size={18} />
              <p><strong>기록 범위</strong>이 가상 활동에서 관찰된 행동만 표시합니다.</p>
            </div>
          </aside>

          <section className="timeline-panel" aria-labelledby="timeline-title">
            <div className="timeline-titlebar">
              <div><span className="eyebrow">세 회기 기록</span><h2 id="timeline-title">학습 목표까지의 반복 기록</h2></div>
              <span className="attempted-badge">{selectedChoice ? '오늘 활동 기록됨' : '오늘 활동 진행 중'}</span>
            </div>

            <ol className="mastery-timeline">
              {demo.previousSessions.map((session) => <SessionTimelineItem key={session.id} session={session} />)}
              <li className="timeline-item is-current">
                <span className="timeline-marker">3</span>
                <article>
                  <div className="timeline-heading"><span>3회기</span><small>오늘</small></div>
                  <h3>{demo.activity.title} · {demo.activity.prompt}</h3>
                  <dl>
                    <div><dt>사용한 도움</dt><dd>{currentSupportLabel}</dd></div>
                    <div><dt>관찰 기록</dt><dd>{currentEvidence}</dd></div>
                  </dl>
                  <div className="evidence-facts" aria-label="Evidence safeguards">
                    <span><Check size={13} /> 활동 행동만 기록</span>
                    <span><Check size={13} /> 학생 점수 없음</span>
                    <span><Check size={13} /> 직업 적합성 판단 없음</span>
                  </div>
                  {supportPacket ? (
                    <section className="model-support-note" aria-label="GPT-5.6 support draft">
                      <span>교사 확인용 GPT-5.6 도움 초안</span>
                      <p>{supportPacket.teacherSummary}</p>
                      <small>
                        {supportPacket.generation.mode === 'live'
                          ? '실시간 GPT-5.6 도움말입니다. 숙달 상태에는 영향을 주지 않습니다.'
                          : '안전하게 준비된 대체 도움말입니다. 숙달 상태에는 영향을 주지 않습니다.'}
                      </small>
                    </section>
                  ) : null}
                </article>
              </li>
              <li className="timeline-item is-future">
                <span className="timeline-marker"><LockKeyhole size={14} /></span>
                <article>
                  <div className="timeline-heading"><span>미래 단계</span><small>잠김</small></div>
                  <h3>{demo.futureStage.title}</h3>
                  <p>{demo.futureStage.description}. 이번 시연에는 면접 대화가 없습니다.</p>
                </article>
              </li>
            </ol>

            <footer className="teacher-confirmation">
              <div>
                <span><Flag size={17} /> 교사 확인 단계</span>
                <p>
                  {confirmed
                    ? '교사가 두 회기의 가상 관찰 기록을 확인했습니다.'
                    : teacherReviewReady
                      ? '서로 다른 두 회기의 관찰 기록을 확인해 주세요.'
                      : '서로 다른 두 회기의 조건 충족 기록이 필요합니다.'}
                </p>
              </div>
              <button
                className={confirmed ? 'primary-action confirmed' : 'primary-action'}
                type="button"
                onClick={onConfirm}
                disabled={confirmed || !teacherReviewReady}
                data-testid="confirm-evidence"
              >
                <FileCheck2 size={18} /> {confirmed ? '관찰 기록 확인 완료' : '두 회기 관찰 기록 확인'}
              </button>
            </footer>
          </section>
        </div>
      </section>
    </main>
  );
}
