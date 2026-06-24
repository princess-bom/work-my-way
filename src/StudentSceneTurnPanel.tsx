import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff
} from 'lucide-react';
import { getSceneImage, jobEidenWelcome } from './assets';
import { getJob, getSceneNarration } from './data';
import type { AacOption, SupportActionId } from './domain';
import { getGuardedStudentSceneTurn } from './guardedSceneTurns';
import { StudentSceneTurnChoices } from './StudentSceneTurnChoices';
import { SceneStatusNote, SceneTurnResponseStatus } from './StudentSceneTurnNotice';
import { SupportActionBar } from './StudentSceneTurnSupport';

type Job = ReturnType<typeof getJob>;

export function DayExperience({
  job,
  sceneIndex,
  selectedSceneId,
  selectedAacOptionId,
  coachReply,
  sceneTurnCount,
  replaying,
  realtimeAvailable,
  realtimeActive,
  realtimePending,
  realtimeMessage,
  resting,
  onScene,
  onAacOption,
  onSupport,
  onRealtimeToggle,
  onBack,
  onNext
}: {
  job: Job;
  sceneIndex: number;
  selectedSceneId: string;
  selectedAacOptionId: string | null;
  coachReply: string | null;
  sceneTurnCount: number;
  replaying: boolean;
  realtimeAvailable?: boolean;
  realtimeActive?: boolean;
  realtimePending?: boolean;
  realtimeMessage?: string | null;
  resting: boolean;
  onScene: (index: number, id: string) => void;
  onAacOption: (option: AacOption) => void;
  onSupport: (action: SupportActionId) => void;
  onRealtimeToggle?: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [helpNoticeOpen, setHelpNoticeOpen] = useState(false);
  const scene = job.scenes.find((item) => item.id === selectedSceneId) ?? job.scenes[sceneIndex] ?? job.scenes[0];
  const sceneTitle = scene.label.replace(/^\d+\s*/, '');
  const activeSceneIndex = Math.max(0, job.scenes.findIndex((item) => item.id === scene.id));
  const sceneNumber = String(activeSceneIndex + 1).padStart(2, '0');
  const sceneImage = getSceneImage(job.id, scene.id);
  const narration = getSceneNarration(scene);
  const guardedTurn = getGuardedStudentSceneTurn(job.id, scene, sceneTurnCount);
  const aacOptions = guardedTurn.aacOptions;
  const statusText = resting
    ? '잠시 쉬어도 괜찮습니다. 준비되면 선생님과 함께 이어가겠습니다.'
    : replaying
      ? guardedTurn.voiceScript
      : guardedTurn.safetyFlags.length
        ? guardedTurn.nextTurnPolicy.fallbackIfNoResponse
        : guardedTurn.voiceScript;

  function chooseScene(index: number, id: string) {
    setHelpNoticeOpen(false);
    onScene(index, id);
  }

  function chooseSupportOption(option: AacOption) {
    setHelpNoticeOpen(option.supportAction === 'help');
    onAacOption(option);
  }

  function chooseSupportAction(action: SupportActionId) {
    setHelpNoticeOpen(action === 'help');
    onSupport(action);
  }

  return (
    <main className="day-screen">
      <section className="day-stage">
        <header className="day-topbar">
          <button className="day-back-button" type="button" onClick={onBack} aria-label="직업 소개로 돌아가기">
            <ChevronLeft size={24} />
          </button>
          <div className="day-title-group">
            <span className="section-label">{job.title}의 하루</span>
            <h2>{job.title} 알아보기</h2>
          </div>
          <div className="scene-option-list scene-progress-rail" aria-label="장면 선택">
            {job.scenes.map((item, index) => {
              const itemTitle = item.label.replace(/^\d+\s*/, '');
              const isActive = item.id === selectedSceneId;
              return (
                <button
                  key={item.id}
                  className={isActive ? 'active' : ''}
                  type="button"
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => chooseScene(index, item.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{itemTitle}</strong>
                </button>
              );
            })}
          </div>
          <button className="primary-cta compact day-next-desktop" type="button" onClick={onNext}>
            정리하기
            <ChevronRight size={18} />
          </button>
        </header>
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
          <aside className="day-choice-panel" aria-label="이든 설명과 표현 버튼">
            <div className="day-guide-card">
              <img className="day-eiden" src={jobEidenWelcome[job.id]} alt={`${job.title} 복장을 한 이든`} draggable={false} />
              <div className="choice-question">
                <span>{replaying ? '설명 듣는 중' : resting ? '쉬는 중' : `이든과 살펴보기 ${guardedTurn.turnIndex}/3`}</span>
                <p>{resting ? '잠시 쉬어도 괜찮아요. 준비되면 선생님과 함께 이어가요.' : guardedTurn.voiceScript}</p>
              </div>
            </div>
            {realtimeAvailable && onRealtimeToggle && (
              <div className={realtimeActive ? 'avatar-realtime-callout active' : 'avatar-realtime-callout'}>
                <button
                  type="button"
                  className="avatar-realtime-start"
                  aria-label={realtimeActive ? '이든 실시간 대화 끄기' : '이든 실시간 대화 시작'}
                  aria-pressed={realtimeActive}
                  disabled={realtimePending}
                  onClick={onRealtimeToggle}
                >
                  {realtimeActive ? <MicOff size={24} /> : <Mic size={24} />}
                  <span>{realtimePending ? '마이크 연결 중' : realtimeActive ? '대화 중지' : '이든과 말하기'}</span>
                </button>
              </div>
            )}
            <StudentSceneTurnChoices
              displayText={guardedTurn.displayText}
              studentQuestion={guardedTurn.studentQuestion}
              options={aacOptions}
              selectedAacOptionId={selectedAacOptionId}
              onChooseOption={chooseSupportOption}
            >
              <SceneTurnResponseStatus coachReply={coachReply} helpNoticeOpen={helpNoticeOpen} />
            </StudentSceneTurnChoices>
            <SceneStatusNote
              statusText={statusText}
              fallbackText={guardedTurn.safetyFlags.length ? `대체 안내: ${narration}` : ''}
            />
            <SupportActionBar
              replaying={replaying}
              onSupport={chooseSupportAction}
            />
            {realtimeMessage && (
              <p className="avatar-realtime-status" role="status">
                {realtimeMessage}
              </p>
            )}
            <button className="primary-cta compact day-next-mobile" type="button" onClick={onNext}>
              정리하기
              <ChevronRight size={18} />
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
