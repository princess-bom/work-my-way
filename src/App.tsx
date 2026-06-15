import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  Bookmark,
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Coffee,
  ClipboardList,
  Clock3,
  Eye,
  Headphones,
  HeartHandshake,
  HelpCircle,
  Library,
  MessageCircle,
  PanelRightOpen,
  PauseCircle,
  Play,
  Sparkles,
  Volume2,
  Wheat,
  X
} from 'lucide-react';
import { createRecord, localSessionRepository, mockCoachGateway } from './adapters';
import { appAssets, getJobVisual, getSceneImage, jobEidenWelcome, pathLandmarks, pathMarkers } from './assets';
import { requestAvatarSpeech } from './avatarVoiceClient';
import { getJob, getSceneNarration, initialState, jobs, stages } from './data';
import type { AppState, ExplorationRecord, JobId, SupportActionId, TeacherDecision, TeacherLog, ViewId } from './domain';
import { JobWorldCanvas } from './JobWorldCanvas';
import { LandingHero } from './LandingHero';
import { getJobTheme } from './theme';

const bannedCopy = ['점수', '등급', '적합률', '정답률', '실패', '오답'];

const stageIndexByView: Record<ViewId, number> = {
  landing: 0,
  path: 1,
  intro: 1,
  day: 2,
  summary: 4,
  saved: 5,
  records: 5,
  teacher: 5
};

const viewLabels: Record<ViewId, string> = {
  landing: '처음',
  path: '직업 길찾기',
  intro: '직업 소개',
  day: '하루 체험',
  summary: '탐색 정리',
  saved: '저장 완료',
  records: '내 기록',
  teacher: '교사 보기'
};

function normalizeLoadedView(view: unknown): ViewId {
  if (view === 'onboarding') return 'intro';
  if (
    view === 'landing' ||
    view === 'path' ||
    view === 'intro' ||
    view === 'day' ||
    view === 'summary' ||
    view === 'saved' ||
    view === 'records' ||
    view === 'teacher'
  ) {
    return view;
  }
  return 'landing';
}

function mergeLoadedState(): AppState {
  const loaded = localSessionRepository.load();
  if (!loaded) return initialState;
  return {
    ...initialState,
    ...loaded,
    view: normalizeLoadedView(loaded.view),
    selectedJobId: loaded.selectedJobId ?? 'barista-aide',
    teacherLogs: loaded.teacherLogs?.length ? loaded.teacherLogs : initialState.teacherLogs,
    records: loaded.records ?? []
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function jobIcon(id: JobId) {
  if (id === 'library-aide') return <Library size={22} />;
  if (id === 'baker-aide') return <Wheat size={22} />;
  return <Coffee size={22} />;
}

const introMessages: Record<JobId, string> = {
  'barista-aide': '바리스타가 일하는 장면을 하나씩 볼게요.',
  'library-aide': '도서관 사서가 일하는 장면을 하나씩 볼게요.',
  'baker-aide': '제빵사가 일하는 장면을 하나씩 볼게요.'
};

export function getIntroContent(job: ReturnType<typeof getJob>) {
  return {
    message: introMessages[job.id],
    cta: '하루 체험하기',
    nextView: 'day' as ViewId
  };
}

export function getNextIntroJobId(jobId: JobId): JobId {
  const currentIndex = jobs.findIndex((job) => job.id === jobId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % jobs.length : 0;
  return jobs[nextIndex].id;
}

let activeSpeechAudio: HTMLAudioElement | null = null;
let activeSpeechUrl: string | null = null;
let speechRequestToken = 0;

function releaseActiveSpeechAudio() {
  if (activeSpeechAudio) {
    activeSpeechAudio.pause();
    activeSpeechAudio.removeAttribute('src');
    activeSpeechAudio.load();
    activeSpeechAudio = null;
  }
  if (activeSpeechUrl) {
    URL.revokeObjectURL(activeSpeechUrl);
    activeSpeechUrl = null;
  }
}

function speakTextWithBrowser(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}

async function speakText(text: string) {
  if (typeof window === 'undefined') return;
  const requestToken = (speechRequestToken += 1);
  releaseActiveSpeechAudio();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();

  try {
    const speech = await requestAvatarSpeech(text);
    if (requestToken !== speechRequestToken) {
      URL.revokeObjectURL(speech.url);
      return;
    }

    const audio = new Audio(speech.url);
    activeSpeechAudio = audio;
    activeSpeechUrl = speech.url;
    const cleanup = () => {
      if (activeSpeechAudio === audio) {
        activeSpeechAudio = null;
        activeSpeechUrl = null;
      }
      URL.revokeObjectURL(speech.url);
    };
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    await audio.play();
  } catch {
    if (requestToken === speechRequestToken) speakTextWithBrowser(text);
  }
}

function scrollToPageTop() {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
}

export function App() {
  const [state, setState] = useState<AppState>(() => mergeLoadedState());
  const job = getJob(state.selectedJobId);
  const theme = getJobTheme(job.id);
  const currentScene = job.scenes.find((scene) => scene.id === state.selectedSceneId) ?? job.scenes[state.currentSceneIndex] ?? job.scenes[0];
  const pendingLogs = state.teacherLogs.filter((log) => log.status === '확인 대기');
  const drawerLog = state.teacherLogs.find((log) => log.id === state.teacherDrawerLogId) ?? null;

  useEffect(() => {
    localSessionRepository.save(state);
  }, [state]);

  const appClassName = [
    'app',
    `view-${state.view}`,
    `job-${job.accent}`,
    state.resting ? 'is-resting' : '',
    state.visualSupportOpen ? 'has-modal' : ''
  ].filter(Boolean).join(' ');
  const appStyle = {
    '--theme-bg': theme.bg,
    '--theme-text': theme.text,
    '--theme-accent': theme.accent,
    '--theme-ghost': theme.ghost,
    '--theme-glow': theme.glow
  } as CSSProperties;

  function update(partial: Partial<AppState>) {
    setState((current) => ({ ...current, ...partial }));
  }

  function go(view: ViewId) {
    update({ view, visualSupportOpen: false, resting: false, replaying: false });
    scrollToPageTop();
  }

  function chooseJob(jobId: JobId) {
    const nextJob = getJob(jobId);
    update({
      selectedJobId: jobId,
      selectedSceneId: nextJob.scenes[0].id,
      currentSceneIndex: 0,
      replaying: false,
      resting: false
    });
  }

  function showNextIntroJob() {
    chooseJob(getNextIntroJobId(state.selectedJobId));
    scrollToPageTop();
  }

  function supportAction(action: SupportActionId) {
    const log = mockCoachGateway.createSupportLog(action, state, job);
    setState((current) => ({
      ...current,
      replaying: action === 'replay',
      visualSupportOpen: action === 'visual' ? true : current.visualSupportOpen,
      resting: action === 'pause',
      teacherLogs: log ? [...current.teacherLogs, log] : current.teacherLogs
    }));

    if (action === 'replay') {
      void speakText(getSceneNarration(currentScene));
      window.setTimeout(() => setState((current) => ({ ...current, replaying: false })), 2200);
    }
  }

  function saveExploration() {
    const record = createRecord(state, job);
    setState((current) => ({
      ...current,
      records: [record, ...current.records],
      view: 'saved'
    }));
    scrollToPageTop();
  }

  function confirmLog(logId: string, decision: TeacherDecision) {
    setState((current) => ({
      ...current,
      teacherLogs: current.teacherLogs.map((log) =>
        log.id === logId
          ? {
              ...log,
              status: '기록 완료',
              summary: `${log.summary} 교사 확인: ${decision}`
            }
          : log
      )
    }));
  }

  return (
    <div className={appClassName} style={appStyle}>
      <div className="responsive-prototype" data-testid="real-ui">
        {state.view === 'teacher' && (
          <Header
            view={state.view}
            pendingCount={pendingLogs.length}
            onHome={() => go('landing')}
            onTeacher={() => go('teacher')}
          />
        )}

        {state.view !== 'landing' && state.view !== 'teacher' && (
          <StudentUtilityNav
            view={state.view}
            pendingCount={pendingLogs.length}
            onHome={() => go('landing')}
            onTeacher={() => go('teacher')}
          />
        )}

        {state.view === 'landing' && (
          <LandingHero
            initialJobId={state.selectedJobId}
            onStart={(jobId) => {
              chooseJob(jobId);
              go('intro');
            }}
            onTeacher={() => go('teacher')}
          />
        )}
        {state.view === 'path' && (
          <JobPath
            selectedJobId={state.selectedJobId}
            onChoose={chooseJob}
            onNext={() => go('intro')}
          />
        )}
        {state.view === 'intro' && (
          <JobIntro
            key={job.id}
            job={job}
            onNext={() => go(getIntroContent(job).nextView)}
            onOtherJob={showNextIntroJob}
          />
        )}
        {state.view === 'day' && (
          <DayExperience
            job={job}
            sceneIndex={state.currentSceneIndex}
            selectedSceneId={state.selectedSceneId}
            replaying={state.replaying}
            resting={state.resting}
            onScene={(index, id) => update({ currentSceneIndex: index, selectedSceneId: id, replaying: false, resting: false })}
            onSupport={supportAction}
            onNext={() => go('summary')}
          />
        )}
        {state.view === 'summary' && (
          <Summary
            job={job}
            selectedSceneId={state.selectedSceneId}
            selectedThought={state.selectedThought}
            onScene={(id) => update({ selectedSceneId: id })}
            onThought={(thought) => update({ selectedThought: thought })}
            onSave={saveExploration}
          />
        )}
        {state.view === 'saved' && (
          <Saved record={state.records[0]} onPath={() => go('path')} onRecords={() => go('records')} onHome={() => go('landing')} />
        )}
        {state.view === 'records' && <Records records={state.records} onPath={() => go('path')} onSummary={() => go('summary')} />}
        {state.view === 'teacher' && (
          <TeacherDashboard
            logs={state.teacherLogs}
            records={state.records}
            onOpen={(id) => update({ teacherDrawerLogId: id })}
            onClose={() => update({ teacherDrawerLogId: null })}
            drawerLog={drawerLog}
            onConfirm={confirmLog}
            onStudent={() => go('path')}
          />
        )}
      </div>

      {state.visualSupportOpen && (
        <VisualSupportModal
          jobTitle={job.title}
          scene={currentScene}
          sceneImage={getSceneImage(job.id, currentScene.id)}
          onClose={() => update({ visualSupportOpen: false })}
        />
      )}
    </div>
  );
}

function Header({
  view,
  pendingCount,
  onHome,
  onTeacher
}: {
  view: ViewId;
  pendingCount: number;
  onHome: () => void;
  onTeacher: () => void;
}) {
  const activeStageIndex = Math.min(stageIndexByView[view], stages.length - 1);
  return (
    <header className="app-header">
      <button className="brand-button" type="button" onClick={onHome} aria-label="처음 화면으로 이동">
        <span className="brand-mark" aria-hidden="true">
          <Sparkles size={27} strokeWidth={2.5} />
        </span>
        <span>
          <strong>꿈이든</strong>
          <em>내일탐색</em>
        </span>
      </button>
      <div className="header-center">
        <span>{viewLabels[view]}</span>
        <div className="stage-dots" aria-hidden="true">
          {stages.map((stage, index) => (
            <i key={stage.id} className={index <= activeStageIndex ? 'active' : ''} />
          ))}
        </div>
      </div>
      <button className="teacher-button" type="button" onClick={onTeacher}>
        <PanelRightOpen size={18} />
        교사용으로 보기
        {pendingCount > 0 && <span>{pendingCount}</span>}
      </button>
    </header>
  );
}

function StudentUtilityNav({
  view,
  pendingCount,
  onHome,
  onTeacher
}: {
  view: ViewId;
  pendingCount: number;
  onHome: () => void;
  onTeacher: () => void;
}) {
  const activeStageIndex = Math.min(stageIndexByView[view], stages.length - 1);
  return (
    <nav className="student-utility-nav" aria-label="학생 체험 보조 메뉴">
      <button className="student-brand-button" type="button" onClick={onHome} aria-label="처음 화면으로 이동">
        <Sparkles size={26} strokeWidth={2.6} aria-hidden="true" />
        <span>
          <strong>꿈이든</strong>
          <em>내일탐색</em>
        </span>
      </button>
      <div className="student-view-chip" aria-label={`현재 화면: ${viewLabels[view]}`}>
        <span>{viewLabels[view]}</span>
        <div className="mini-stage-dots" aria-hidden="true">
          {stages.map((stage, index) => (
            <i key={stage.id} className={index <= activeStageIndex ? 'active' : ''} />
          ))}
        </div>
      </div>
      <button
        className="student-mini-button teacher-mini-button"
        type="button"
        onClick={onTeacher}
        aria-label={pendingCount > 0 ? `교사용으로 보기, 확인할 기록 ${pendingCount}건` : '교사용으로 보기'}
      >
        <PanelRightOpen size={21} />
      </button>
    </nav>
  );
}

function JobPath({
  selectedJobId,
  onChoose,
  onNext
}: {
  selectedJobId: JobId;
  onChoose: (jobId: JobId) => void;
  onNext: () => void;
}) {
  const selectedJob = getJob(selectedJobId);
  return (
    <main className="path-screen">
      <aside className="path-intro">
        <div className="section-label">직업 길찾기</div>
        <h2>오늘 궁금한 직업을 하나 골라볼까요?</h2>
        <p>이든이 직업의 하루를 장면으로 보여주고, 선생님은 필요한 지원을 조용히 확인합니다.</p>
        <div className="eden-card">
          <img className="eden-card-img" src={appAssets.characters.wave} alt="안내하는 이든" draggable={false} />
          <p>천천히 골라도 괜찮아요. 마음이 가는 직업을 선택해 보세요.</p>
        </div>
      </aside>

      <section className="job-map-panel">
        <img className="map-backplate" src={appAssets.path.layeredBase} alt="" draggable={false} />
        <img className="job-map-landmark landmark-cafe" src={appAssets.path.landmarks.cafe} alt="" draggable={false} />
        <img className="job-map-landmark landmark-library" src={appAssets.path.landmarks.library} alt="" draggable={false} />
        <img className="job-map-landmark landmark-bakery" src={appAssets.path.landmarks.bakery} alt="" draggable={false} />
        <img className="job-map-marker marker-chat" src={appAssets.path.markers.chat} alt="" draggable={false} />
        <img className="job-map-marker marker-book" src={appAssets.path.markers.book} alt="" draggable={false} />
        <img className="job-map-marker marker-bread" src={appAssets.path.markers.bread} alt="" draggable={false} />
        <JobWorldCanvas selectedJobId={selectedJobId} />
        <img className="selected-job-diorama" src={pathLandmarks[selectedJobId]} alt={`${selectedJob.title} 일터 그림`} draggable={false} />
        <div className="job-card-row">
          {jobs.map((job, index) => (
            <button
              key={job.id}
              className={`job-choice-card job-node-${index + 1} ${job.id === selectedJobId ? 'selected' : ''}`}
              type="button"
              onClick={() => onChoose(job.id)}
            >
              <img src={pathLandmarks[job.id]} alt="" draggable={false} />
              <img className="job-choice-marker" src={pathMarkers[job.id]} alt="" draggable={false} />
              <span>{jobIcon(job.id)}</span>
              <strong>{job.title}</strong>
              <small>{job.shortDescription}</small>
            </button>
          ))}
        </div>
        <div className="path-footer">
          <div>
            <span>선택한 직업</span>
            <strong>{selectedJob.title}</strong>
          </div>
          <button className="primary-cta compact" type="button" onClick={onNext}>
            직업 만나기
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

    </main>
  );
}

function JobIntro({
  job,
  onNext,
  onOtherJob
}: {
  job: ReturnType<typeof getJob>;
  onNext: () => void;
  onOtherJob: () => void;
}) {
  const visual = getJobVisual(job.id);
  const intro = getIntroContent(job);
  return (
    <main className="intro-screen" aria-labelledby="intro-title">
      <section className="intro-copy">
        <h2 id="intro-title">{job.title}의 하루를 살펴봐요</h2>
        <div className="intro-listen-row">
          <p>{intro.message}</p>
        </div>
      </section>
      <section className="intro-visual-stage" aria-label={`${job.title} 활동 공간과 이든`}>
        <img className="intro-diorama-art" src={visual.diorama} alt={`${job.title} 활동 공간`} draggable={false} />
        <img className="intro-eiden-art" src={jobEidenWelcome[job.id]} alt={`${job.title} 복장을 한 이든`} draggable={false} />
      </section>
      <div className="intro-actions">
        <button className="primary-cta" type="button" onClick={onNext}>
          {intro.cta}
          <ChevronRight size={20} />
        </button>
        <button className="secondary-cta" type="button" onClick={onOtherJob}>
          다른 직업 보기
          <ChevronRight size={18} />
        </button>
      </div>
    </main>
  );
}

function DayExperience({
  job,
  sceneIndex,
  selectedSceneId,
  replaying,
  resting,
  onScene,
  onSupport,
  onNext
}: {
  job: ReturnType<typeof getJob>;
  sceneIndex: number;
  selectedSceneId: string;
  replaying: boolean;
  resting: boolean;
  onScene: (index: number, id: string) => void;
  onSupport: (action: SupportActionId) => void;
  onNext: () => void;
}) {
  const scene = job.scenes.find((item) => item.id === selectedSceneId) ?? job.scenes[sceneIndex] ?? job.scenes[0];
  const sceneTitle = scene.label.replace(/^\d+\s*/, '');
  const activeSceneIndex = Math.max(0, job.scenes.findIndex((item) => item.id === scene.id));
  const sceneNumber = String(activeSceneIndex + 1).padStart(2, '0');
  const sceneImage = getSceneImage(job.id, scene.id);
  const narration = getSceneNarration(scene);
  return (
    <main className="day-screen">
      <section className="day-stage">
        <div className="day-heading">
          <div>
            <span className="section-label">{job.title}의 하루</span>
            <h2>{job.title} 알아보기</h2>
          </div>
          <button className="primary-cta compact" type="button" onClick={onNext}>
            정리하기
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="day-layout">
          <article className="scene-focus" aria-labelledby="day-scene-title">
            <img className="scene-focus-image" src={sceneImage} alt={`${job.title} ${sceneTitle} 장면`} draggable={false} />
            <div className="scene-focus-caption">
              <span>{sceneNumber}</span>
              <div>
                <strong id="day-scene-title">{sceneTitle}</strong>
                <em>{scene.description}</em>
              </div>
            </div>
          </article>
          <aside className="day-choice-panel" aria-label="이든 질문과 장면 선택">
            <img className="day-eiden" src={jobEidenWelcome[job.id]} alt={`${job.title} 복장을 한 이든`} draggable={false} />
            <div className="choice-question">
              <span>{replaying ? '설명 듣는 중' : resting ? '쉬는 중' : '이든의 설명'}</span>
              <p>{resting ? '잠시 쉬어도 괜찮아요. 준비되면 선생님과 함께 이어가요.' : narration}</p>
            </div>
            <div className="scene-option-list">
              {job.scenes.map((item, index) => (
                <button
                  key={item.id}
                  className={item.id === selectedSceneId ? 'active' : ''}
                  type="button"
                  onClick={() => onScene(index, item.id)}
                >
                  <img src={getSceneImage(job.id, item.id)} alt="" draggable={false} />
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item.label.replace(/^\d+\s*/, '')}</strong>
                </button>
              ))}
            </div>
            <SupportActionBar replaying={replaying} onSupport={onSupport} />
          </aside>
        </div>
      </section>
    </main>
  );
}

function SupportActionBar({ replaying, onSupport }: { replaying: boolean; onSupport: (action: SupportActionId) => void }) {
  return (
    <nav className="support-bar" aria-label="학생 지원 행동">
      <button type="button" className={replaying ? 'active' : ''} onClick={() => onSupport('replay')}>
        <Volume2 size={21} />
        이든 설명 듣기
      </button>
      <button type="button" onClick={() => onSupport('visual')}>
        <Eye size={21} />
        그림으로 보기
      </button>
      <button type="button" onClick={() => onSupport('help')}>
        <HeartHandshake size={21} />
        도움 요청
      </button>
      <button type="button" onClick={() => onSupport('pause')}>
        <PauseCircle size={21} />
        잠깐 쉬기
      </button>
    </nav>
  );
}

function Summary({
  job,
  selectedSceneId,
  selectedThought,
  onScene,
  onThought,
  onSave
}: {
  job: ReturnType<typeof getJob>;
  selectedSceneId: string;
  selectedThought: string;
  onScene: (id: string) => void;
  onThought: (thought: string) => void;
  onSave: () => void;
}) {
  const thoughts = ['해보고 싶어요', '조금 어려웠어요', '더 알아볼래요'];
  const selectedScene = job.scenes.find((scene) => scene.id === selectedSceneId) ?? job.scenes[0];
  return (
    <main className="summary-screen screen-grid">
      <section className="info-panel">
        <span className="section-label">탐색 정리</span>
        <h2>{job.title}를 알아봤어요</h2>
        <div className="summary-feature">
          <img src={getJobVisual(job.id).diorama} alt={`${job.title} 대표 그림`} draggable={false} />
          <div>
            <span>{job.iconLabel}</span>
            <strong>{selectedScene.label.replace(/^\d+\s*/, '')}</strong>
            <p>{selectedScene.description}</p>
          </div>
        </div>
        <div className="choice-list large">
          {job.scenes.map((scene) => (
            <button key={scene.id} className={scene.id === selectedSceneId ? 'selected' : ''} type="button" onClick={() => onScene(scene.id)}>
              <img src={getSceneImage(job.id, scene.id)} alt="" draggable={false} />
              <strong>{scene.label}</strong>
              <span>{scene.description}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="note-panel">
        <div className="summary-visual">
          <img src={getJobVisual(job.id).diorama} alt={`${job.title} 대표 그림`} draggable={false} />
          <img src={appAssets.characters.neutral} alt="기록을 돕는 이든" draggable={false} />
        </div>
        <h3>내 생각</h3>
        <div className="thought-row">
          {thoughts.map((thought) => (
            <button key={thought} className={thought === selectedThought ? 'selected' : ''} type="button" onClick={() => onThought(thought)}>
              {thought}
            </button>
          ))}
        </div>
        <article className="eden-note-card large">
          <strong>이든 노트</strong>
          <p>{job.title}에서 기억에 남은 장면과 내 생각을 저장해요. 다음 수업에서 선생님과 다시 볼 수 있습니다.</p>
        </article>
        <button className="primary-cta" type="button" onClick={onSave}>
          기록 저장
          <CheckCircle2 size={20} />
        </button>
      </section>
    </main>
  );
}

function Saved({
  record,
  onPath,
  onRecords,
  onHome
}: {
  record?: ExplorationRecord;
  onPath: () => void;
  onRecords: () => void;
  onHome: () => void;
}) {
  const jobVisual = record ? getJobVisual(record.jobId) : getJobVisual('barista-aide');
  return (
    <main className="saved-screen">
      <img className="saved-stage-eiden" src={appAssets.characters.celebration} alt="저장을 축하하는 이든" draggable={false} />
      <img className="saved-stage-notebook" src={appAssets.save.notebook} alt="" draggable={false} />
      <div className="saved-notebook-copy" aria-hidden="true">
        <strong>{record?.jobTitle ?? '직업'} 탐색 기록</strong>
        <span>기억에 남은 일</span>
        <p>{record?.memorableScene ?? '오늘 살펴본 장면'}</p>
        <span>내 생각</span>
        <p>{record?.studentThought ?? '해보고 싶어요'}</p>
        <span>이든 노트</span>
        <p>{record?.edenNote ?? '다음 수업에서 다시 살펴볼 수 있어요.'}</p>
      </div>
      <div className="saved-eiden-bubble">수고했어요!<br />다음에도 함께 탐색해요.</div>
      <section className="saved-card">
        <CheckCircle2 size={42} />
        <h2>기록이 저장됐어요</h2>
        <p>{record ? `${record.jobTitle}에서 ${record.memorableScene} 장면을 기록했습니다.` : '오늘 탐색한 내용을 저장했습니다.'}</p>
        <div className="saved-job-chip">
          <img src={jobVisual.diorama} alt="" draggable={false} />
          <div>
            <strong>{record?.jobTitle ?? '직업 탐색'}</strong>
            <span>{record?.memorableScene ?? '오늘의 장면'}</span>
          </div>
        </div>
        <div className="saved-summary">
          <span>내 생각</span>
          <strong>{record?.studentThought ?? '해보고 싶어요'}</strong>
          <p>{record?.edenNote ?? '다음 수업에서 다시 살펴볼 수 있어요.'}</p>
        </div>
        <div className="landing-actions">
          <button className="primary-cta compact" type="button" onClick={onPath}>다른 직업 보기</button>
          <button className="secondary-cta" type="button" onClick={onRecords}>내 기록 보기</button>
          <button className="secondary-cta" type="button" onClick={onHome}>처음으로</button>
        </div>
      </section>
    </main>
  );
}

function Records({
  records,
  onPath,
  onSummary
}: {
  records: ExplorationRecord[];
  onPath: () => void;
  onSummary: () => void;
}) {
  const primaryRecord = records[0];
  const recordsByJob = new Map(records.map((record) => [record.jobId, record]));
  const primaryJob = primaryRecord ? jobs.find((job) => job.id === primaryRecord.jobId) : undefined;
  const orderedJobs = primaryJob ? [primaryJob, ...jobs.filter((job) => job.id !== primaryJob.id)] : jobs;
  return (
    <main className="records-screen">
      <img className="records-backplate" src={appAssets.records.scrapbook} alt="" draggable={false} />
      <section className="records-head">
        <div>
          <span className="section-label">내 기록</span>
          <h2>내 기록</h2>
          <p>살펴본 직업을 다시 볼 수 있어요.</p>
        </div>
        <button className="primary-cta compact" type="button" onClick={onPath}>다른 직업 보기</button>
      </section>
      {primaryRecord && (
        <section className="records-note">
          <img src={appAssets.characters.neutral} alt="" draggable={false} />
          <div>
            <strong>멋지게 탐색했어요!</strong>
            <p>필요할 때 언제든 다시 볼 수 있어요.</p>
          </div>
        </section>
      )}
      <section className="record-list">
        {records.length ? orderedJobs.map((job, index) => {
          const record = recordsByJob.get(job.id);
          return (
            <article key={job.id} className={`record-card ${record ? 'is-saved' : 'is-pending'} ${index === 0 ? 'featured' : ''}`}>
              <img src={getJobVisual(job.id).diorama} alt="" draggable={false} />
              <span>{record ? formatTime(record.createdAt) : '아직 정리 전'}</span>
              <h3>{job.title}</h3>
              <p>{record ? `${record.memorableScene} · ${record.studentThought}` : '다음에 볼 수 있어요.'}</p>
              <div>{record ? record.edenNote : job.shortDescription}</div>
              <button type="button" onClick={record ? onSummary : onPath}>{record ? '다시 보기' : '다음에 보기'}</button>
            </article>
          );
        }) : (
          <article className="record-card empty">
            <img src={appAssets.records.scrapbook} alt="" draggable={false} />
            <h3>아직 저장한 기록이 없습니다</h3>
            <p>직업 탐색을 마치면 이곳에서 다시 볼 수 있어요.</p>
            <button type="button" onClick={onPath}>직업 길찾기</button>
          </article>
        )}
      </section>
    </main>
  );
}

function TeacherDashboard({
  logs,
  records,
  drawerLog,
  onOpen,
  onClose,
  onConfirm,
  onStudent
}: {
  logs: TeacherLog[];
  records: ExplorationRecord[];
  drawerLog: TeacherLog | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  onConfirm: (id: string, decision: TeacherDecision) => void;
  onStudent: () => void;
}) {
  const pending = logs.filter((log) => log.status === '확인 대기');
  const completed = logs.filter((log) => log.status === '기록 완료');
  const references = logs.filter((log) => log.status === '참고 기록');
  const activeLog = drawerLog ?? pending[0] ?? logs[0];
  const tools = ['질문 예시 만들기', '그림 자료로 다시 보기', 'AAC로 표현', '쉬기 후 재개', '다음 수업에서 더 보기'];
  return (
    <main className="teacher-screen">
      <div className="teacher-layout">
        <aside className="teacher-sidebar" aria-label="교사 대시보드 메뉴">
          <div className="teacher-sidebar-brand">
            <span>이</span>
            <strong>꿈이든</strong>
            <small>내일탐색</small>
          </div>
          {[
            ['확인할 기록', Clock3],
            ['대화 기록', MessageCircle],
            ['지원 필요', HelpCircle],
            ['지원 기록', ClipboardList],
            ['수업 도구', BriefcaseBusiness]
          ].map(([label, Icon], index) => {
            const MenuIcon = Icon as typeof Clock3;
            return (
              <button key={label as string} className={index === 0 ? 'active' : ''} type="button">
                <MenuIcon size={20} />
                {label as string}
              </button>
            );
          })}
          <div className="teacher-profile">
            <img src={appAssets.teacher.teacherAvatar} alt="" draggable={false} />
            <strong>이선생님</strong>
            <span>특수교사</span>
          </div>
        </aside>

        <section className="teacher-main">
          <section className="teacher-top">
            <div>
              <span className="section-label">교사 대시보드</span>
              <h2>학생의 탐색 기록을 보고 다음 수업 지원을 준비해요</h2>
            </div>
            <button className="secondary-cta" type="button" onClick={onStudent}>
              학생 화면으로
            </button>
          </section>

          <section className="teacher-metric-row" aria-label="기록 상태 요약">
            <article className="metric-card emphasis">
              <Clock3 size={28} />
              <strong>{pending.length}건</strong>
              <span>교사 확인 대기</span>
            </article>
            <article className="metric-card">
              <CheckCircle2 size={28} />
              <strong>{completed.length}건</strong>
              <span>기록 완료</span>
            </article>
            <article className="metric-card">
              <Bookmark size={28} />
              <strong>{references.length}건</strong>
              <span>참고 기록</span>
            </article>
          </section>

          <section className="teacher-content-grid">
            <div className="teacher-content-main">
              <Panel title="대화 기록">
                <div className="table-like">
                  {logs.slice().reverse().map((log) => (
                    <button key={log.id} type="button" onClick={() => onOpen(log.id)}>
                      <span>{formatTime(log.createdAt)}</span>
                      <strong>{log.studentName}</strong>
                      <span>{log.jobTitle}</span>
                      <span>{log.stageLabel}</span>
                      <span>{log.signal}</span>
                      <em>{log.status}</em>
                    </button>
                  ))}
                </div>
              </Panel>

              {activeLog && (
                <section className="teacher-student-card">
                  <img src={getJobVisual(jobIdForTitle(activeLog.jobTitle)).diorama} alt="" draggable={false} />
                  <div>
                    <span>{activeLog.studentName} · {activeLog.jobTitle}</span>
                    <strong>{activeLog.stageLabel}</strong>
                    <p>{activeLog.summary}</p>
                  </div>
                  <div className="teacher-action-stack">
                    <button type="button" onClick={() => onConfirm(activeLog.id, '이해 확인')}>교사 확인</button>
                    <button type="button" onClick={() => onOpen(activeLog.id)}>자세히 보기</button>
                  </div>
                </section>
              )}
            </div>

            <aside className="teacher-support-column">
              <Panel title="확인할 기록" count={pending.length}>
                {pending.map((log) => (
                  <button key={log.id} className="review-row" type="button" onClick={() => onOpen(log.id)}>
                    <img src={appAssets.teacher.studentAvatars} alt="" draggable={false} />
                    <strong>{log.studentName}</strong>
                    <span>{log.jobTitle} · {log.signal}</span>
                    <em>{log.status}</em>
                  </button>
                ))}
              </Panel>

              <Panel title="지원 필요 순간">
                {logs.filter((log) => log.signal === '도움 필요' || log.signal === '쉬기/전환' || log.signal === '모름/불확실').slice(-4).map((log) => (
                  <button key={log.id} className="support-moment" type="button" onClick={() => onOpen(log.id)}>
                    <span>{log.signal}</span>
                    <p>{log.summary}</p>
                  </button>
                ))}
              </Panel>

              <Panel title="수업 지원 도구">
                <div className="tool-grid">
                  {tools.map((tool) => (
                    <button key={tool} type="button">{tool}</button>
                  ))}
                </div>
              </Panel>
            </aside>
          </section>
        </section>
      </div>

      {drawerLog && <TeacherDrawer log={drawerLog} onClose={onClose} onConfirm={onConfirm} />}
    </main>
  );
}

function jobIdForTitle(title: string): JobId {
  return jobs.find((job) => job.title === title)?.id ?? 'barista-aide';
}

function Panel({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <article className="dashboard-panel">
      <header>
        <h3>{title}</h3>
        {typeof count === 'number' && <span>{count}</span>}
      </header>
      {children}
    </article>
  );
}

function TeacherDrawer({
  log,
  onClose,
  onConfirm
}: {
  log: TeacherLog;
  onClose: () => void;
  onConfirm: (id: string, decision: TeacherDecision) => void;
}) {
  const decisions: TeacherDecision[] = ['이해 확인', '그림 자료로 다시 보기', 'AAC로 표현', '쉬기 후 재개', '다음 수업에서 더 보기'];
  return (
    <aside className="teacher-drawer" aria-label="학생 관찰 상세">
      <button className="icon-button" type="button" onClick={onClose} aria-label="상세 닫기">
        <X size={18} />
      </button>
      <span className="section-label">학생 관찰 상세</span>
      <h3>{log.studentName}</h3>
      <dl>
        <div><dt>직업</dt><dd>{log.jobTitle}</dd></div>
        <div><dt>활동 단계</dt><dd>{log.stageLabel}</dd></div>
        <div><dt>관찰 신호</dt><dd>{log.signal}</dd></div>
        <div><dt>확인 상태</dt><dd>{log.status}</dd></div>
      </dl>
      <article className="drawer-note">
        <strong>이든 요약</strong>
        <p>{log.summary}</p>
      </article>
      <div className="drawer-actions">
        {decisions.map((decision) => (
          <button key={decision} type="button" onClick={() => onConfirm(log.id, decision)}>
            {decision}
          </button>
        ))}
      </div>
    </aside>
  );
}

function VisualSupportModal({
  jobTitle,
  scene,
  sceneImage,
  onClose
}: {
  jobTitle: string;
  scene: ReturnType<typeof getJob>['scenes'][number];
  sceneImage: string;
  onClose: () => void;
}) {
  const sceneTitle = scene.label.replace(/^\d+\s*/, '');
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="visual-modal" role="dialog" aria-modal="true" aria-label="그림으로 보기">
        <button className="icon-button" type="button" onClick={onClose} aria-label="그림 보기 닫기">
          <X size={18} />
        </button>
        <span className="section-label">그림으로 보기</span>
        <h3>{jobTitle} · {scene.label}</h3>
        <img className="support-visual-image" src={sceneImage} alt={`${sceneTitle} 장면을 그림으로 살펴보기`} draggable={false} />
        <div className="visual-card-set">
          <article><Coffee size={34} /><strong>도구 보기</strong><span>먼저 사용하는 물건을 봅니다.</span></article>
          <article><Play size={34} /><strong>한 장면씩</strong><span>작은 단계로 다시 봅니다.</span></article>
          <article><Headphones size={34} /><strong>이든 설명</strong><span>이든의 말을 천천히 들어요.</span></article>
        </div>
      </section>
    </div>
  );
}

export function hasBannedCopy(text: string) {
  return bannedCopy.some((item) => text.includes(item));
}
