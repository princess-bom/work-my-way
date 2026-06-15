import type { AppState, JobProfile, TeacherLog } from './domain';

export const jobs: JobProfile[] = [
  {
    id: 'barista-aide',
    title: '바리스타',
    shortDescription: '커피와 음료를 만들고 카페 도구를 준비합니다.',
    introduction: '컵과 도구를 준비하고, 손님을 맞이하고, 음료를 만들며 카페를 정리하는 일을 살펴봅니다.',
    accent: 'mint',
    iconLabel: '카페',
    scenes: [
      {
        id: 'prep',
        label: '01 준비하기',
        description: '컵과 도구를 가지런히 준비합니다.',
        prompt: '바리스타가 먼저 준비하는 것은 무엇일까요?',
        narration: '이든이 컵과 도구를 먼저 가지런히 준비하는 장면이에요. 바리스타가 처음 확인할 것은 무엇일까요?'
      },
      {
        id: 'guest',
        label: '02 손님 맞이',
        description: '손님을 보고 인사와 안내를 합니다.',
        prompt: '손님을 맞이할 때 어떤 말이 필요할까요?',
        narration: '이든이 손님을 보고 차분히 인사하며 안내하는 장면이에요. 어떤 말이 편안하게 들릴까요?'
      },
      {
        id: 'drink',
        label: '03 음료 만들기',
        description: '주문을 보고 음료를 차근차근 만듭니다.',
        prompt: '음료를 만들 때 조심해야 할 일은 무엇일까요?',
        narration: '이든이 주문을 보고 음료를 차근차근 만드는 장면이에요. 조심해서 살펴볼 도구는 무엇일까요?'
      },
      {
        id: 'clean',
        label: '04 정리하기',
        description: '테이블과 도구를 다시 정돈합니다.',
        prompt: '마지막에 정리하면 좋은 곳은 어디일까요?',
        narration: '이든이 사용한 도구와 작업대를 다시 정돈하는 장면이에요. 마무리할 때 어디를 살피면 좋을까요?'
      }
    ],
    choices: [
      { id: 'cups', label: '컵 준비', description: '컵과 도구를 정리해요.' },
      { id: 'guest', label: '손님 돕기', description: '인사하고 안내해요.' },
      { id: 'clean', label: '카페 정리', description: '테이블을 정리해요.' }
    ]
  },
  {
    id: 'library-aide',
    title: '도서관 사서',
    shortDescription: '책을 분류하고 이용자가 책을 찾도록 돕습니다.',
    introduction: '반납된 책을 제자리에 놓고, 책을 찾는 사람을 안내하고, 도서관 공간을 정리합니다.',
    accent: 'blue',
    iconLabel: '도서관',
    scenes: [
      {
        id: 'return',
        label: '01 반납 확인',
        description: '돌아온 책을 살펴봅니다.',
        prompt: '돌아온 책은 어디에 두면 좋을까요?',
        narration: '이든이 돌아온 책을 살펴보고 분류하는 장면이에요. 책을 어디에 두면 다음 사람이 찾기 쉬울까요?'
      },
      {
        id: 'shelf',
        label: '02 책 정리',
        description: '책을 주제와 번호에 맞게 놓습니다.',
        prompt: '책을 제자리에 놓으면 어떤 점이 좋을까요?',
        narration: '이든이 책을 주제와 위치에 맞게 서가에 놓는 장면이에요. 책이 제자리에 있으면 어떤 점이 좋을까요?'
      },
      {
        id: 'guide',
        label: '03 이용 안내',
        description: '책을 찾는 사람에게 위치를 알려줍니다.',
        prompt: '책을 찾는 사람에게 무엇을 알려줄까요?',
        narration: '이든이 책을 찾는 사람에게 위치를 안내하는 장면이에요. 어떤 정보를 먼저 알려주면 도움이 될까요?'
      },
      {
        id: 'space',
        label: '04 공간 정돈',
        description: '책상과 서가 주변을 차분히 살핍니다.',
        prompt: '도서관을 정리할 때 볼 곳은 어디일까요?',
        narration: '이든이 책상과 서가 주변을 차분히 정돈하는 장면이에요. 조용한 공간을 위해 어디를 살피면 좋을까요?'
      }
    ],
    choices: [
      { id: 'books', label: '책 정리', description: '책을 제자리에 놓아요.' },
      { id: 'guide', label: '이용 안내', description: '책 찾기를 도와요.' },
      { id: 'space', label: '공간 정리', description: '서가 주변을 살펴요.' }
    ]
  },
  {
    id: 'baker-aide',
    title: '제빵사',
    shortDescription: '빵을 만들고 포장하며 제빵 도구를 정리합니다.',
    introduction: '빵집에서 도구를 준비하고, 반죽을 섞고, 빵을 굽고, 작업대를 보기 좋게 정돈합니다.',
    accent: 'amber',
    iconLabel: '빵집',
    scenes: [
      {
        id: 'tools',
        label: '01 도구 준비',
        description: '반죽 도구와 재료를 차분히 준비합니다.',
        prompt: '제빵사가 먼저 준비하는 도구는 무엇일까요?',
        narration: '이든이 반죽 도구와 재료를 차분히 준비하는 장면이에요. 제빵사가 먼저 확인할 도구는 무엇일까요?'
      },
      {
        id: 'mix',
        label: '02 반죽 섞기',
        description: '재료를 넣고 반죽을 천천히 섞습니다.',
        prompt: '반죽을 섞을 때 어떤 순서로 해볼까요?',
        narration: '이든이 재료를 넣고 반죽을 천천히 섞는 장면이에요. 어떤 순서로 살펴보면 좋을까요?'
      },
      {
        id: 'bake',
        label: '03 굽기',
        description: '빵이 오븐에서 익어 가는 모습을 봅니다.',
        prompt: '빵을 구울 때 기다려야 하는 순간은 언제일까요?',
        narration: '이든이 오븐 앞에서 빵이 익어 가는 모습을 살피는 장면이에요. 기다려야 하는 순간은 언제일까요?'
      },
      {
        id: 'clean',
        label: '04 정리하기',
        description: '도구와 작업대를 다시 정돈합니다.',
        prompt: '마지막에 정리하면 좋은 곳은 어디일까요?',
        narration: '이든이 도구와 작업대를 다시 정돈하는 장면이에요. 마무리할 때 어디를 살피면 좋을까요?'
      }
    ],
    choices: [
      { id: 'tools', label: '도구 정리', description: '도구를 가지런히 놓아요.' },
      { id: 'mix', label: '반죽 섞기', description: '재료를 천천히 섞어요.' },
      { id: 'clean', label: '작업대 정리', description: '마무리를 함께 살펴요.' }
    ]
  }
];

export const stages = [
  { id: 'greeting', label: '만나기' },
  { id: 'broaden', label: '넓히기' },
  { id: 'deepen', label: '살펴보기' },
  { id: 'connect', label: '나누기' },
  { id: 'reflect', label: '정리' },
  { id: 'complete', label: '마침' }
] as const;

export const initialTeacherLogs: TeacherLog[] = [
  {
    id: 'log-demo-1',
    createdAt: new Date(Date.now() - 38 * 60_000).toISOString(),
    studentName: '이민석 학생',
    jobTitle: '바리스타',
    stageLabel: '살펴보기',
    signal: '흥미',
    supportLevel: '기본',
    summary: '컵 준비와 손님 맞이에 관심을 보였습니다. 다음 수업에서 카페 도구 그림을 다시 보겠습니다.',
    status: '참고 기록'
  },
  {
    id: 'log-demo-2',
    createdAt: new Date(Date.now() - 22 * 60_000).toISOString(),
    studentName: '박지원 학생',
    jobTitle: '제빵사',
    stageLabel: '그림 지원',
    signal: '도움 필요',
    supportLevel: '시각+선택 중심',
    summary: '빵 포장과 도구 정리 그림 중 빵 포장 그림을 먼저 짚어주면 좋겠습니다.',
    status: '확인 대기'
  }
];

export const initialState: AppState = {
  view: 'landing',
  selectedJobId: 'barista-aide',
  currentSceneIndex: 0,
  selectedSceneId: 'prep',
  selectedThought: '해보고 싶어요',
  replaying: false,
  visualSupportOpen: false,
  resting: false,
  teacherDrawerLogId: null,
  teacherLogs: initialTeacherLogs,
  records: []
};

export function getJob(jobId: string): JobProfile {
  return jobs.find((job) => job.id === jobId) ?? jobs[0];
}

export function getSceneNarration(scene: JobProfile['scenes'][number]) {
  return scene.narration ?? `${scene.description} ${scene.prompt}`;
}
