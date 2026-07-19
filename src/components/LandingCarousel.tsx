import { ArrowLeft, ArrowRight, GraduationCap, Sparkles } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { JOBS, type JobCard, type JobId } from '../data/jobs';

type LandingCarouselProps = {
  initialJobId?: JobId;
  onStart: (jobId: JobId) => void;
  onTeacher: () => void;
};

type CarouselRole = 'center' | 'left' | 'right';

function roleFor(index: number, activeIndex: number): CarouselRole {
  if (index === activeIndex) return 'center';
  return index === (activeIndex + JOBS.length - 1) % JOBS.length ? 'left' : 'right';
}

function itemStyle(role: CarouselRole): CSSProperties {
  return { '--carousel-role': role } as CSSProperties;
}

export function LandingCarousel({ initialJobId = 'library-aide', onStart, onTeacher }: LandingCarouselProps) {
  const initialIndex = Math.max(0, JOBS.findIndex((job) => job.id === initialJobId));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeJob: JobCard = JOBS[activeIndex];

  useEffect(() => {
    JOBS.forEach((job) => {
      const image = new Image();
      image.src = job.diorama;
    });
  }, []);

  function move(direction: -1 | 1) {
    setActiveIndex((current) => (current + direction + JOBS.length) % JOBS.length);
  }

  return (
    <main
      className="landing-carousel"
      style={{
        '--job-bg': activeJob.theme.background,
        '--job-text': activeJob.theme.text,
        '--job-accent': activeJob.theme.accent,
        '--job-glow': activeJob.theme.glow
      } as CSSProperties}
    >
      <header className="landing-topbar">
        <div className="landing-brand" aria-label="꿈이든 내일탐색">
          <Sparkles aria-hidden="true" />
          <strong>꿈이든</strong>
          <span>내일탐색</span>
        </div>
        <button className="teacher-entry" type="button" onClick={onTeacher}>
          <GraduationCap aria-hidden="true" />
          교사용으로 보기
        </button>
      </header>

      <div className="landing-ghost-title" aria-hidden="true">{activeJob.backgroundTitle}</div>

      <section className="carousel-stage" aria-live="polite" aria-label={`${activeJob.title} 직업 카드`}>
        {JOBS.map((job, index) => {
          const role = roleFor(index, activeIndex);
          return (
            <button
              className={`carousel-job carousel-job-${role}`}
              style={itemStyle(role)}
              type="button"
              key={job.id}
              tabIndex={role === 'center' ? 0 : -1}
              aria-label={role === 'center' ? `${job.title} 선택됨` : `${job.title} 보기`}
              onClick={() => role === 'center' ? onStart(job.id) : setActiveIndex(index)}
            >
              <img src={job.diorama} alt={`${job.title} 직업 공간 디오라마`} draggable={false} />
            </button>
          );
        })}
      </section>

      <section className="landing-copy">
        <span className="landing-track">{activeJob.track}</span>
        <h1>{activeJob.title}</h1>
        <p>{activeJob.description}</p>
        <div className="landing-actions">
          <div className="carousel-arrows" aria-label="직업 바꾸기">
            <button type="button" aria-label="이전 직업" onClick={() => move(-1)}><ArrowLeft /></button>
            <button type="button" aria-label="다음 직업" onClick={() => move(1)}><ArrowRight /></button>
          </div>
          <button className="landing-start" type="button" onClick={() => onStart(activeJob.id)}>
            {activeJob.demoReady ? '직업 탐색 시작하기' : '직업 둘러보기'}
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="carousel-position" aria-label={`${activeIndex + 1} / ${JOBS.length}`}>
        {JOBS.map((job, index) => <span key={job.id} className={index === activeIndex ? 'active' : ''} />)}
      </div>
    </main>
  );
}
