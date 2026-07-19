import type { DemoState } from '../data/demo-store';
import type { SupportLevel } from '../domain/mastery';

export type SupportRequest = 'show' | 'help' | 'break';

export type CanonicalChoiceId = 'return-cart' | 'shelf-now' | 'front-desk';

export type MasterySession = {
  id: string;
  label: string;
  dateLabel: string;
  activity: string;
  supportLevel: string;
  evidence: string;
  status: 'completed' | 'attempted';
};

export type CanonicalChoice = {
  id: CanonicalChoiceId;
  label: string;
  description: string;
  isCanonical: boolean;
};

export type MasteryDemoViewModel = {
  learner: {
    name: string;
    initials: string;
    notice: string;
  };
  learningGoal: string;
  activity: {
    title: string;
    context: string;
    prompt: string;
    attemptLabel: string;
    choices: CanonicalChoice[];
  };
  previousSessions: MasterySession[];
  futureStage: {
    title: string;
    description: string;
  };
};

export const masteryDemo: MasteryDemoViewModel = {
  learner: {
    name: '민준 (가상 학생)',
    initials: '민준',
    notice: '성인 심사자를 위한 가상 학생 기록'
  },
  learningGoal: '서로 다른 두 회기에서 그림 선택 도움 이하로 반납 카트를 선택한다.',
  activity: {
    title: '도서관 사서',
    context: '도서관 책상 위에 반납된 책이 있어요.',
    prompt: '반납된 책은 어디에 먼저 놓을까요?',
    attemptLabel: '3회기 · 오늘의 학습',
    choices: [
      {
        id: 'return-cart',
        label: '반납 카트에 놓아요',
        description: '분류하기 전에 반납된 책을 한곳에 모아요.',
        isCanonical: true
      },
      {
        id: 'shelf-now',
        label: '바로 책장에 꽂아요',
        description: '위치를 확인하기 전에 책장에 놓아요.',
        isCanonical: false
      },
      {
        id: 'front-desk',
        label: '책상에 그대로 두어요',
        description: '반납된 자리에 책을 남겨 두어요.',
        isCanonical: false
      }
    ]
  },
  previousSessions: [
    {
      id: 'session-1',
      label: '1회기',
      dateLabel: '이전 학습',
      activity: '반납대 살펴보기',
      supportLevel: '말로 한 번 도움',
      evidence: '다른 위치를 선택하여 수업을 계속했습니다.',
      status: 'completed'
    },
    {
      id: 'session-2',
      label: '2회기',
      dateLabel: '이전 학습',
      activity: '책 라벨 비교하기',
      supportLevel: '그림 선택 도움',
      evidence: '반납 카트를 선택하여 목표 행동이 관찰되었습니다.',
      status: 'completed'
    }
  ],
  futureStage: {
    title: '직업 면접 연습',
    description: '미래 단계 · 이번 MVP에는 포함되지 않음'
  }
};

export function supportLevelLabel(level: SupportLevel): string {
  if (level === 'none') return '도움 없이 수행';
  if (level === 'visual_choice') return '그림 선택 도움';
  if (level === 'verbal_prompt') return '말로 한 번 도움';
  return '직접 시범 도움';
}

/** Maps only synthetic local records into presentation copy. It never derives a
 * learner score or asks a model to interpret the record. */
export function createMasteryDemoView(state: DemoState): MasteryDemoViewModel {
  const learner = state.profiles.find((profile) => profile.role === 'learner')!;
  const goal = state.goals[0];
  const previousSessions = state.sessions.slice(0, 2).map((session, index) => {
    const attempt = state.attempts.find((item) => item.sessionId === session.id);
    return {
      id: session.id,
      label: `${index + 1}회기`,
      dateLabel: '이전 학습',
      activity: session.activityLabel,
      supportLevel: attempt ? supportLevelLabel(attempt.supportLevel) : 'No attempt recorded',
      evidence: attempt?.criterionMet
        ? '반납 카트를 선택하여 목표 행동이 관찰되었습니다.'
        : '다른 위치를 선택하여 수업을 계속했습니다.',
      status: 'completed' as const
    };
  });

  return {
    ...masteryDemo,
    learner: { ...masteryDemo.learner, name: learner.displayName },
    learningGoal: goal.observableCriterion,
    previousSessions
  };
}

export function feedbackForChoice(choice: CanonicalChoice): string {
  if (choice.isCanonical) {
    return '반납 카트를 선택했습니다. 반납된 책을 분류하기 전에 한곳에 모으는 행동이 관찰되었습니다.';
  }

  return `“${choice.label}”를 선택했습니다. 이 회기는 그대로 기록하고 다음 수업을 이어갑니다.`;
}

export function supportLabel(request: SupportRequest | null): string {
  if (request === 'show') return '그림 선택 도움';
  if (request === 'help') return '말로 한 번 도움';
  if (request === 'break') return '쉬기 요청(수행 도움 아님)';
  return '도움 없이 수행';
}
