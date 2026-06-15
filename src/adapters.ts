import type { AppState, CoachGateway, ExplorationRecord, JobProfile, SessionRepository, SupportActionId, TeacherLog } from './domain';

const storageKey = 'kkumideun-findjob-frontend-session-v1';

export const localSessionRepository: SessionRepository = {
  load() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Partial<AppState>) : null;
    } catch {
      return null;
    }
  },
  save(state) {
    localStorage.setItem(storageKey, JSON.stringify(state));
  },
  clear() {
    localStorage.removeItem(storageKey);
  }
};

function nowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const mockCoachGateway: CoachGateway = {
  createSupportLog(action: SupportActionId, state: AppState, job: JobProfile) {
    if (action !== 'help' && action !== 'pause' && action !== 'visual') return null;

    const signal = action === 'pause' ? '쉬기/전환' : action === 'help' ? '도움 필요' : '모름/불확실';
    const supportLevel = action === 'visual' ? '시각+선택 중심' : '교사 확인 대기';
    const actionLabel = action === 'pause' ? '잠깐 쉬기' : action === 'help' ? '도움 요청' : '그림으로 보기';

    return {
      id: nowId('log'),
      createdAt: new Date().toISOString(),
      studentName: '홍길동 학생',
      jobTitle: job.title,
      stageLabel: state.currentSceneIndex >= 0 ? job.scenes[state.currentSceneIndex]?.label ?? '탐색 중' : '탐색 중',
      signal,
      supportLevel,
      summary: `${actionLabel}을 선택했습니다. ${job.title} 활동을 같은 장면에서 다시 지원합니다.`,
      status: '확인 대기'
    };
  }
};

export function createRecord(state: AppState, job: JobProfile): ExplorationRecord {
  const scene = job.scenes.find((item) => item.id === state.selectedSceneId) ?? job.scenes[state.currentSceneIndex] ?? job.scenes[0];
  return {
    id: nowId('record'),
    createdAt: new Date().toISOString(),
    studentName: '홍길동 학생',
    jobId: job.id,
    jobTitle: job.title,
    memorableScene: scene.label.replace(/^\d+\s*/, ''),
    studentThought: state.selectedThought,
    edenNote: `${job.title}에서 ${scene.description} 장면을 기억했습니다. 다음 수업에서는 그림 자료로 한 번 더 살펴보면 좋겠습니다.`,
    logs: state.teacherLogs.slice(-4)
  };
}
