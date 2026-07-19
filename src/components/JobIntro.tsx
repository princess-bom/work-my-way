import { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, LockKeyhole } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { JobCard } from '../data/jobs';

type JobIntroProps = {
  job: JobCard;
  onBack: () => void;
  onStartLearning: () => void;
  onChooseLibrary: () => void;
};

export function JobIntro({ job, onBack, onStartLearning, onChooseLibrary }: JobIntroProps) {
  return (
    <main className="job-intro-screen" style={{ '--intro-bg': job.theme.background, '--intro-text': job.theme.text } as CSSProperties}>
      <header className="student-topbar">
        <button className="round-back" type="button" onClick={onBack} aria-label="이전 화면"><ArrowLeft /></button>
        <span>직업 알아보기</span>
        <span className="session-pill">가상 학습 세션</span>
      </header>

      <section className="job-intro-layout">
        <div className="job-intro-visual">
          <span className="job-intro-ghost" aria-hidden="true">{job.backgroundTitle}</span>
          <img src={job.diorama} alt={`${job.title} 직업 공간`} />
        </div>
        <article className="job-intro-copy">
          <span className="step-kicker">{job.track}</span>
          <h1>{job.title}는<br />어떤 일을 할까요?</h1>
          <p>{job.introduction}</p>

          {job.demoReady ? (
            <>
              <ul className="intro-points">
                <li><CheckCircle2 /> 반납된 책을 확인해요.</li>
                <li><CheckCircle2 /> 책 라벨과 위치를 맞춰요.</li>
                <li><BookOpenCheck /> 여러 번 연습하며 익혀요.</li>
              </ul>
              <button className="large-student-cta" type="button" onClick={onStartLearning}>
                사서 일 살펴보기 <ArrowRight />
              </button>
            </>
          ) : (
            <div className="preview-notice">
              <LockKeyhole aria-hidden="true" />
              <div>
                <strong>{job.title} 학습은 다음 단계에서 열려요.</strong>
                <p>이번 시연에서는 도서관 사서 숙달학습 과정을 끝까지 체험할 수 있어요.</p>
              </div>
              <button type="button" onClick={onChooseLibrary}>도서관 사서 체험하기 <ArrowRight /></button>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
