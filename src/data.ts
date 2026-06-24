import type { AacOption, AppState, JobProfile, TeacherLog } from './domain';

function aacOptions(options: AacOption[]): AacOption[] {
  return options;
}

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
        narration: '카페 일을 시작하기 전에 컵과 도구를 가지런히 준비합니다. 바리스타는 필요한 물건을 먼저 확인하며 차분히 일을 준비합니다.',
        observationPrompt: '그림에서 보이는 물건이나 행동을 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['컵', '도구', '수건', '커피콩'],
        aacOptions: aacOptions([
          { id: 'cups', label: '컵', value: '컵이 보여요', type: 'object' },
          { id: 'tools', label: '도구', value: '도구가 보여요', type: 'object' },
          { id: 'prepare', label: '준비해요', value: '일하기 전에 준비해요', type: 'action' }
        ]),
        conversationGoal: '학생이 바리스타가 일을 시작하기 전에 컵과 도구를 준비한다는 점을 관찰하도록 돕는다.'
      },
      {
        id: 'guest',
        label: '02 손님 맞이',
        description: '손님을 보고 인사와 안내를 합니다.',
        prompt: '손님을 맞이할 때 어떤 말이 필요할까요?',
        narration: '카페에 온 손님을 보고 차분히 인사합니다. 바리스타는 손님의 주문을 듣고 필요한 안내를 합니다.',
        observationPrompt: '그림에서 보이는 사람이나 행동을 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['손님', '인사', '주문', '카운터'],
        aacOptions: aacOptions([
          { id: 'guest', label: '손님', value: '손님이 보여요', type: 'object' },
          { id: 'greeting', label: '인사해요', value: '손님에게 인사해요', type: 'action' },
          { id: 'order', label: '주문 들어요', value: '주문을 들어요', type: 'action' }
        ]),
        conversationGoal: '학생이 바리스타가 손님을 맞이하고 주문을 듣는 장면을 관찰하도록 돕는다.'
      },
      {
        id: 'drink',
        label: '03 음료 만들기',
        description: '주문을 보고 음료를 차근차근 만듭니다.',
        prompt: '음료를 만들 때 조심해야 할 일은 무엇일까요?',
        narration: '주문을 확인하고 음료를 차근차근 만듭니다. 바리스타는 도구를 안전하게 사용하며 음료를 준비합니다.',
        observationPrompt: '그림에서 보이는 도구나 행동을 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['커피머신', '컵', '음료', '주문'],
        aacOptions: aacOptions([
          { id: 'machine', label: '커피머신', value: '커피머신이 보여요', type: 'object' },
          { id: 'drink', label: '음료', value: '음료를 만들어요', type: 'action' },
          { id: 'safe', label: '조심해요', value: '도구를 조심해서 써요', type: 'action' }
        ]),
        conversationGoal: '학생이 바리스타가 주문을 보고 음료를 만드는 행동을 관찰하도록 돕는다.'
      },
      {
        id: 'clean',
        label: '04 정리하기',
        description: '테이블과 도구를 다시 정돈합니다.',
        prompt: '마지막에 정리하면 좋은 곳은 어디일까요?',
        narration: '사용한 도구와 작업대를 다시 정돈합니다. 바리스타는 다음 일을 위해 주변을 깨끗하게 정리합니다.',
        observationPrompt: '그림에서 보이는 정리 행동을 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['작업대', '도구', '테이블', '정리'],
        aacOptions: aacOptions([
          { id: 'counter', label: '작업대', value: '작업대가 보여요', type: 'object' },
          { id: 'tools-clean', label: '도구 정리', value: '도구를 정리해요', type: 'action' },
          { id: 'clean-space', label: '깨끗하게', value: '깨끗하게 정리해요', type: 'action' }
        ]),
        conversationGoal: '학생이 바리스타가 일을 마친 뒤 도구와 공간을 정리하는 장면을 관찰하도록 돕는다.'
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
        narration: '도서관으로 돌아온 책을 살펴봅니다. 사서는 반납된 책을 확인하고 다음 정리를 준비합니다.',
        observationPrompt: '그림에서 보이는 책이나 행동을 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['책', '반납대', '확인', '분류'],
        aacOptions: aacOptions([
          { id: 'book', label: '책', value: '책이 보여요', type: 'object' },
          { id: 'return-desk', label: '반납대', value: '반납대가 보여요', type: 'object' },
          { id: 'check-book', label: '확인해요', value: '책을 확인해요', type: 'action' }
        ]),
        conversationGoal: '학생이 사서가 반납된 책을 확인하는 장면을 관찰하도록 돕는다.'
      },
      {
        id: 'shelf',
        label: '02 책 정리',
        description: '책을 주제와 번호에 맞게 놓습니다.',
        prompt: '책을 제자리에 놓으면 어떤 점이 좋을까요?',
        narration: '책을 주제와 번호에 맞게 서가에 놓습니다. 사서는 사람들이 책을 다시 찾기 쉽도록 제자리를 확인합니다.',
        observationPrompt: '그림에서 보이는 책이나 정리 행동을 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['책', '책장', '번호', '정리'],
        aacOptions: aacOptions([
          { id: 'shelf-book', label: '책', value: '책이 보여요', type: 'object' },
          { id: 'bookshelf', label: '책장', value: '책장이 보여요', type: 'object' },
          { id: 'organize-book', label: '정리해요', value: '책을 정리해요', type: 'action' }
        ]),
        conversationGoal: '학생이 사서가 책을 제자리에 놓는 장면을 관찰하도록 돕는다.'
      },
      {
        id: 'guide',
        label: '03 이용 안내',
        description: '책을 찾는 사람에게 위치를 알려줍니다.',
        prompt: '책을 찾는 사람에게 무엇을 알려줄까요?',
        narration: '책을 찾는 사람에게 위치를 안내합니다. 사서는 필요한 책이 어디에 있는지 차분히 알려줍니다.',
        observationPrompt: '그림에서 보이는 사람이나 안내 행동을 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['이용자', '책', '안내', '위치'],
        aacOptions: aacOptions([
          { id: 'visitor', label: '이용자', value: '책을 찾는 사람이 보여요', type: 'object' },
          { id: 'location', label: '위치', value: '책 위치를 알려줘요', type: 'action' },
          { id: 'guide-action', label: '안내해요', value: '이용자를 안내해요', type: 'action' }
        ]),
        conversationGoal: '학생이 사서가 이용자에게 책 위치를 안내하는 장면을 관찰하도록 돕는다.'
      },
      {
        id: 'space',
        label: '04 공간 정돈',
        description: '책상과 서가 주변을 차분히 살핍니다.',
        prompt: '도서관을 정리할 때 볼 곳은 어디일까요?',
        narration: '책상과 서가 주변을 차분히 살핍니다. 사서는 도서관을 조용하고 이용하기 좋은 공간으로 정돈합니다.',
        observationPrompt: '그림에서 보이는 공간이나 정리 행동을 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['책상', '서가', '공간', '조용히'],
        aacOptions: aacOptions([
          { id: 'desk', label: '책상', value: '책상이 보여요', type: 'object' },
          { id: 'shelves', label: '서가', value: '서가가 보여요', type: 'object' },
          { id: 'quiet-clean', label: '정돈해요', value: '공간을 정돈해요', type: 'action' }
        ]),
        conversationGoal: '학생이 사서가 도서관 공간을 정돈하는 장면을 관찰하도록 돕는다.'
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
        narration: '빵을 만들기 전에 반죽 도구와 재료를 차분히 준비합니다. 제빵사는 필요한 물건을 먼저 확인합니다.',
        observationPrompt: '그림에서 보이는 도구나 재료를 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['그릇', '밀가루', '도구', '재료'],
        aacOptions: aacOptions([
          { id: 'bowl', label: '그릇', value: '그릇이 보여요', type: 'object' },
          { id: 'flour', label: '밀가루', value: '밀가루가 보여요', type: 'object' },
          { id: 'prepare-tools', label: '준비해요', value: '도구를 준비해요', type: 'action' }
        ]),
        conversationGoal: '학생이 제빵사가 빵을 만들기 전에 도구와 재료를 준비하는 장면을 관찰하도록 돕는다.'
      },
      {
        id: 'mix',
        label: '02 반죽 섞기',
        description: '재료를 넣고 반죽을 천천히 섞습니다.',
        prompt: '반죽을 섞을 때 어떤 순서로 해볼까요?',
        narration: '재료를 넣고 반죽을 천천히 섞습니다. 제빵사는 순서를 확인하며 반죽의 상태를 살핍니다.',
        observationPrompt: '그림에서 보이는 재료나 섞는 행동을 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['반죽', '재료', '섞기', '그릇'],
        aacOptions: aacOptions([
          { id: 'dough', label: '반죽', value: '반죽이 보여요', type: 'object' },
          { id: 'mix-action', label: '섞어요', value: '반죽을 섞어요', type: 'action' },
          { id: 'ingredients', label: '재료', value: '재료가 보여요', type: 'object' }
        ]),
        conversationGoal: '학생이 제빵사가 재료를 넣고 반죽을 섞는 장면을 관찰하도록 돕는다.'
      },
      {
        id: 'bake',
        label: '03 굽기',
        description: '빵이 오븐에서 익어 가는 모습을 봅니다.',
        prompt: '빵을 구울 때 기다려야 하는 순간은 언제일까요?',
        narration: '오븐 앞에서 빵이 익어 가는 모습을 살핍니다. 제빵사는 뜨거운 오븐 주변에서 안전하게 기다립니다.',
        observationPrompt: '그림에서 보이는 빵이나 안전 행동을 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['오븐', '빵', '장갑', '기다리기'],
        aacOptions: aacOptions([
          { id: 'oven', label: '오븐', value: '오븐이 보여요', type: 'object' },
          { id: 'bread', label: '빵', value: '빵이 보여요', type: 'object' },
          { id: 'hot-safe', label: '조심해요', value: '뜨거워서 조심해요', type: 'action' }
        ]),
        conversationGoal: '학생이 제빵사가 오븐 앞에서 안전하게 빵을 굽는 장면을 관찰하도록 돕는다.'
      },
      {
        id: 'clean',
        label: '04 정리하기',
        description: '도구와 작업대를 다시 정돈합니다.',
        prompt: '마지막에 정리하면 좋은 곳은 어디일까요?',
        narration: '사용한 도구와 작업대를 다시 정돈합니다. 제빵사는 다음 작업을 위해 주변을 깨끗하게 마무리합니다.',
        observationPrompt: '그림에서 보이는 정리 행동을 버튼으로 표현해도 괜찮습니다.',
        visualTargets: ['작업대', '도구', '수건', '정리'],
        aacOptions: aacOptions([
          { id: 'baker-counter', label: '작업대', value: '작업대가 보여요', type: 'object' },
          { id: 'baker-tools-clean', label: '도구 정리', value: '도구를 정리해요', type: 'action' },
          { id: 'baker-clean', label: '깨끗하게', value: '깨끗하게 마무리해요', type: 'action' }
        ]),
        conversationGoal: '학생이 제빵사가 일을 마친 뒤 작업대를 정리하는 장면을 관찰하도록 돕는다.'
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

export const initialTeacherLogs: TeacherLog[] = [];

export const initialState: AppState = {
  view: 'landing',
  selectedJobId: 'barista-aide',
  currentSceneIndex: 0,
  selectedSceneId: 'prep',
  selectedThought: '해보고 싶어요',
  selectedAacOptionId: null,
  coachReply: null,
  sceneTurnCount: 0,
  replaying: false,
  visualSupportOpen: false,
  resting: false,
  studentSession: undefined,
  teacherDrawerLogId: null,
  teacherLogs: initialTeacherLogs,
  records: []
};

export function getJob(jobId: string): JobProfile {
  return jobs.find((job) => job.id === jobId) ?? jobs[0];
}

export function getSceneNarration(scene: JobProfile['scenes'][number]) {
  return scene.narration ?? scene.description;
}

export function getSceneObservationPrompt(scene: JobProfile['scenes'][number]) {
  return scene.observationPrompt ?? '그림에서 보이는 것을 버튼으로 표현해도 괜찮습니다.';
}

export function getSceneAacOptions(scene: JobProfile['scenes'][number]): AacOption[] {
  return scene.aacOptions ?? aacOptions([{ id: 'scene', label: scene.label.replace(/^\d+\s*/, ''), value: scene.description, type: 'action' }]);
}

export function createCoachReply(scene: JobProfile['scenes'][number], option: AacOption) {
  if (option.id === 'unsure') {
    return '괜찮습니다. 말로 하지 않아도 되고, 그림에서 보이는 단어를 천천히 골라도 됩니다.';
  }

  if (option.supportAction === 'help') {
    return '선생님 도움을 요청하겠습니다. 같은 장면에서 천천히 이어가도 괜찮습니다.';
  }

  if (option.supportAction === 'replay') {
    return '이든과 대화하며 같은 장면을 다시 살펴보겠습니다.';
  }

  return `${option.label}에 함께 집중해보겠습니다. ${scene.description}`;
}
