import type { JobId } from './domain';

export type SceneConversationTurnPurpose = 'observe' | 'meaning' | 'practice_or_support';

export type SceneConversationTurn = {
  purpose: SceneConversationTurnPurpose;
  voiceScript: string;
  displayText: string;
  studentQuestion: string;
  expectedResponseOptionIds: string[];
};

export type SceneConversationPracticeStep = {
  kind: 'choose' | 'say_phrase' | 'sequence' | 'teacher_supported';
  studentAction: string;
  supportIfNeeded: string;
};

export type SceneConversationPlan = {
  deliveredInfo: string[];
  turns: [SceneConversationTurn, SceneConversationTurn, SceneConversationTurn];
  practiceStep: SceneConversationPracticeStep;
  evidenceCandidate: string;
  supportFallback: string;
  teacherNextGuidance: string;
  aacOptionIds: string[];
};

export const sceneConversationPlans: Record<JobId, Record<string, SceneConversationPlan>> = {
  'barista-aide': {
    prep: {
      deliveredInfo: ['바리스타는 일을 시작하기 전에 컵과 도구를 확인한다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '컵과 도구가 보여요. 먼저 보이는 것을 하나 골라볼까요?',
          displayText: '먼저 보이는 것을 골라요.',
          studentQuestion: '그림에서 보이는 준비 물건을 하나 골라볼까요?',
          expectedResponseOptionIds: ['cups', 'tools']
        },
        {
          purpose: 'meaning',
          voiceScript: '준비된 컵과 도구는 손님 음료를 만들 때 필요해요. 무엇을 먼저 준비하면 좋을까요?',
          displayText: '음료를 만들 준비를 해요.',
          studentQuestion: '먼저 준비하면 좋은 것을 골라볼까요?',
          expectedResponseOptionIds: ['cups', 'tools', 'prepare']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '컵, 도구, 준비해요 중에서 하나를 골라요. 어려우면 선택을 줄여서 다시 볼게요.',
          displayText: '준비하는 말을 연습해요.',
          studentQuestion: '준비할 때 쓸 말을 골라볼까요?',
          expectedResponseOptionIds: ['cups', 'tools', 'prepare']
        }
      ],
      practiceStep: {
        kind: 'choose',
        studentAction: '컵, 도구, 준비 행동 중 하나를 선택한다.',
        supportIfNeeded: '컵과 도구 두 선택지만 남기고 그림 단서를 다시 보여준다.'
      },
      evidenceCandidate: '장면 단서 관찰, 준비 행동 표현',
      supportFallback: '컵과 도구 사진을 다시 보여주고 한 가지 선택으로 줄인다.',
      teacherNextGuidance: '실물 컵/도구 사진으로 "먼저 준비해요" 문장 연결 연습',
      aacOptionIds: ['cups', 'tools', 'prepare']
    },
    guest: {
      deliveredInfo: ['바리스타는 손님에게 인사하고 주문을 듣는다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '손님과 카운터가 보여요. 누가 카페에 왔는지 골라볼까요?',
          displayText: '카페에 온 사람을 봐요.',
          studentQuestion: '카페에 온 사람을 골라볼까요?',
          expectedResponseOptionIds: ['guest']
        },
        {
          purpose: 'meaning',
          voiceScript: '손님이 오면 인사하고 주문을 들어요. 어떤 말이나 행동이 필요할까요?',
          displayText: '인사하고 주문을 들어요.',
          studentQuestion: '손님에게 필요한 행동을 골라볼까요?',
          expectedResponseOptionIds: ['greeting', 'order']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '인사해요 또는 주문 들어요를 골라요. 말로 해볼 수 있으면 안녕하세요를 짧게 말해요.',
          displayText: '손님 맞이 말을 연습해요.',
          studentQuestion: '손님을 맞이할 때 쓸 말을 골라볼까요?',
          expectedResponseOptionIds: ['greeting', 'order']
        }
      ],
      practiceStep: {
        kind: 'say_phrase',
        studentAction: '인사해요 또는 주문 들어요를 선택하고, 가능하면 안녕하세요를 말한다.',
        supportIfNeeded: '인사 카드와 주문 듣기 카드만 놓고 하나를 고르게 한다.'
      },
      evidenceCandidate: '사람/역할 관찰, 응대 행동 연결',
      supportFallback: '손님 그림과 인사 카드를 나란히 두고 선택을 돕는다.',
      teacherNextGuidance: '역할놀이로 인사 카드와 주문 듣기 카드를 번갈아 사용',
      aacOptionIds: ['guest', 'greeting', 'order']
    },
    drink: {
      deliveredInfo: ['주문을 보고 도구를 안전하게 사용해 음료를 만든다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '커피머신과 컵이 보여요. 음료 만들 때 보이는 것을 골라볼까요?',
          displayText: '음료 도구를 살펴봐요.',
          studentQuestion: '음료 만들 때 보이는 것을 하나 골라볼까요?',
          expectedResponseOptionIds: ['machine', 'drink']
        },
        {
          purpose: 'meaning',
          voiceScript: '주문을 확인하고 차근차근 만들어요. 어떤 것을 조심하면 좋을까요?',
          displayText: '주문을 보고 차근차근 만들어요.',
          studentQuestion: '음료를 만들 때 조심할 것을 골라볼까요?',
          expectedResponseOptionIds: ['machine', 'safe']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '조심해요를 고르거나 도구를 조심해서 써요라고 말해요. 어려우면 안전 그림을 함께 봐요.',
          displayText: '안전한 사용을 연습해요.',
          studentQuestion: '안전하게 하려면 어떤 말을 고를까요?',
          expectedResponseOptionIds: ['safe', 'drink']
        }
      ],
      practiceStep: {
        kind: 'say_phrase',
        studentAction: '조심해요를 선택하거나 도구를 조심해서 써요 문장을 연습한다.',
        supportIfNeeded: '커피머신과 안전 그림만 제시하고 조심해요 선택으로 연결한다.'
      },
      evidenceCandidate: '안전 단서 관찰, 순서/주의 표현',
      supportFallback: '뜨거운 도구, 컵, 주문 그림 중 안전 그림을 먼저 짚어준다.',
      teacherNextGuidance: '뜨거운 도구, 컵, 주문 그림으로 안전 선택 연습',
      aacOptionIds: ['machine', 'drink', 'safe']
    },
    clean: {
      deliveredInfo: ['일을 마친 뒤 도구와 작업대를 정돈한다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '작업대와 도구가 보여요. 정리할 곳을 골라볼까요?',
          displayText: '정리할 곳을 찾아요.',
          studentQuestion: '그림에서 정리할 곳을 하나 골라볼까요?',
          expectedResponseOptionIds: ['counter', 'tools-clean']
        },
        {
          purpose: 'meaning',
          voiceScript: '정리하면 다음 일을 준비하기 쉬워요. 무엇을 제자리에 놓을까요?',
          displayText: '다음 일을 위해 정리해요.',
          studentQuestion: '제자리에 놓을 것을 골라볼까요?',
          expectedResponseOptionIds: ['counter', 'tools-clean']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '도구 정리 또는 깨끗하게를 골라요. 어려우면 정리 전과 뒤 사진을 함께 봐요.',
          displayText: '마무리 행동을 연습해요.',
          studentQuestion: '마지막에 할 행동을 골라볼까요?',
          expectedResponseOptionIds: ['tools-clean', 'clean-space']
        }
      ],
      practiceStep: {
        kind: 'choose',
        studentAction: '도구 정리 또는 깨끗하게를 선택한다.',
        supportIfNeeded: '정리 전과 뒤 사진을 비교하고 한 가지 정리 행동만 고르게 한다.'
      },
      evidenceCandidate: '마무리 행동 관찰, 작업 종료 루틴 이해',
      supportFallback: '작업대 사진에서 도구 하나만 가리키고 정리 행동으로 연결한다.',
      teacherNextGuidance: '작업대 사진에서 "정리 전/후"를 비교하고 한 가지 정리 행동 선택',
      aacOptionIds: ['counter', 'tools-clean', 'clean-space']
    }
  },
  'library-aide': {
    return: {
      deliveredInfo: ['사서는 돌아온 책을 확인하고 다음 정리를 준비한다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '책과 반납대가 보여요. 돌아온 물건을 골라볼까요?',
          displayText: '돌아온 책을 살펴봐요.',
          studentQuestion: '돌아온 물건을 하나 골라볼까요?',
          expectedResponseOptionIds: ['book', 'return-desk']
        },
        {
          purpose: 'meaning',
          voiceScript: '반납된 책은 확인한 뒤 정리해요. 책을 어디에 두면 좋을까요?',
          displayText: '반납된 책을 확인해요.',
          studentQuestion: '책을 확인할 곳을 골라볼까요?',
          expectedResponseOptionIds: ['book', 'return-desk', 'check-book']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '책을 확인해요를 골라요. 어려우면 책과 반납대 두 그림만 함께 봐요.',
          displayText: '반납 확인을 연습해요.',
          studentQuestion: '반납 책을 보고 어떤 행동을 할까요?',
          expectedResponseOptionIds: ['check-book']
        }
      ],
      practiceStep: {
        kind: 'choose',
        studentAction: '책을 확인해요를 선택한다.',
        supportIfNeeded: '책과 반납대 두 선택지만 제시한다.'
      },
      evidenceCandidate: '책/반납대 관찰, 반납 절차 인식',
      supportFallback: '실제 책과 반납함 사진을 놓고 책 확인 행동을 다시 고른다.',
      teacherNextGuidance: '실제 책과 반납함 사진으로 "확인해요" 선택 반복',
      aacOptionIds: ['book', 'return-desk', 'check-book']
    },
    shelf: {
      deliveredInfo: ['책을 주제와 번호에 맞게 놓으면 다시 찾기 쉽다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '책장과 책이 보여요. 정리할 물건을 골라볼까요?',
          displayText: '책장과 책을 살펴봐요.',
          studentQuestion: '정리할 물건을 하나 골라볼까요?',
          expectedResponseOptionIds: ['shelf-book', 'bookshelf']
        },
        {
          purpose: 'meaning',
          voiceScript: '책을 제자리에 놓으면 사람들이 다시 찾기 쉬워요. 어디에 놓을까요?',
          displayText: '책을 제자리에 놓아요.',
          studentQuestion: '책을 놓을 곳을 골라볼까요?',
          expectedResponseOptionIds: ['bookshelf', 'organize-book']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '책을 정리해요를 고르거나 같은 색과 번호 책을 맞춰요.',
          displayText: '책 정리를 연습해요.',
          studentQuestion: '책을 정리할 때 할 행동을 골라볼까요?',
          expectedResponseOptionIds: ['organize-book']
        }
      ],
      practiceStep: {
        kind: 'sequence',
        studentAction: '책을 정리해요를 선택하거나 같은 색/번호 책을 맞춘다.',
        supportIfNeeded: '색이나 번호가 보이는 책 2권만 제시하고 같은 자리로 놓게 한다.'
      },
      evidenceCandidate: '분류/정리 행동 관찰, 위치 연결',
      supportFallback: '책과 책장 사진만 남기고 제자리 놓기 행동을 선택하게 한다.',
      teacherNextGuidance: '색/번호 라벨 책 2-3권을 같은 자리로 놓는 연습',
      aacOptionIds: ['shelf-book', 'bookshelf', 'organize-book']
    },
    guide: {
      deliveredInfo: ['사서는 책을 찾는 사람에게 위치를 알려준다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '책을 찾는 사람이 보여요. 누구를 도와줄까요?',
          displayText: '도움을 받을 사람을 봐요.',
          studentQuestion: '책을 찾는 사람을 골라볼까요?',
          expectedResponseOptionIds: ['visitor']
        },
        {
          purpose: 'meaning',
          voiceScript: '사서는 책 위치를 차분히 알려줘요. 무엇을 알려주면 좋을까요?',
          displayText: '책 위치를 안내해요.',
          studentQuestion: '무엇을 알려주면 좋을지 골라볼까요?',
          expectedResponseOptionIds: ['location', 'guide-action']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '책 위치를 알려줘요 또는 안내해요를 골라요. 가능하면 방향 카드도 함께 써요.',
          displayText: '안내 행동을 연습해요.',
          studentQuestion: '안내할 때 쓸 행동을 골라볼까요?',
          expectedResponseOptionIds: ['location', 'guide-action']
        }
      ],
      practiceStep: {
        kind: 'teacher_supported',
        studentAction: '책 위치를 알려줘요 또는 안내해요를 선택하고 방향 카드로 표현한다.',
        supportIfNeeded: '책을 찾는 사람 그림과 위치 카드만 제시한다.'
      },
      evidenceCandidate: '도움 대상 관찰, 안내 행동 이해',
      supportFallback: '책을 찾는 사람 그림을 먼저 가리키고 위치 카드 선택으로 이어간다.',
      teacherNextGuidance: '짧은 역할놀이: "책 어디 있어요?"에 위치 카드 선택',
      aacOptionIds: ['visitor', 'location', 'guide-action']
    },
    space: {
      deliveredInfo: ['도서관은 책상과 서가를 조용히 정돈한다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '책상과 서가가 보여요. 정돈할 곳을 골라볼까요?',
          displayText: '정돈할 공간을 찾아요.',
          studentQuestion: '정돈할 곳을 하나 골라볼까요?',
          expectedResponseOptionIds: ['desk', 'shelves']
        },
        {
          purpose: 'meaning',
          voiceScript: '공간을 정돈하면 조용히 이용하기 좋아요. 어디를 살펴볼까요?',
          displayText: '도서관 공간을 정돈해요.',
          studentQuestion: '도서관에서 살펴볼 곳을 골라볼까요?',
          expectedResponseOptionIds: ['desk', 'shelves', 'quiet-clean']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '공간을 정돈해요를 골라요. 어려우면 책상과 서가 사진만 함께 봐요.',
          displayText: '공간 정돈을 연습해요.',
          studentQuestion: '정돈할 때 할 행동을 골라볼까요?',
          expectedResponseOptionIds: ['quiet-clean']
        }
      ],
      practiceStep: {
        kind: 'choose',
        studentAction: '공간을 정돈해요를 선택한다.',
        supportIfNeeded: '책상과 서가 사진만 제시하고 한 곳을 고르게 한다.'
      },
      evidenceCandidate: '공간 단서 관찰, 정돈 행동 표현',
      supportFallback: '책상 또는 서가 사진 하나를 보여주고 정돈 행동으로 연결한다.',
      teacherNextGuidance: '책상 위 물건 사진에서 제자리에 둘 것 1개 고르기',
      aacOptionIds: ['desk', 'shelves', 'quiet-clean']
    }
  },
  'baker-aide': {
    tools: {
      deliveredInfo: ['제빵사는 빵을 만들기 전에 도구와 재료를 확인한다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '그릇과 밀가루가 보여요. 먼저 준비할 것을 골라볼까요?',
          displayText: '도구와 재료를 살펴봐요.',
          studentQuestion: '먼저 준비할 것을 하나 골라볼까요?',
          expectedResponseOptionIds: ['bowl', 'flour']
        },
        {
          purpose: 'meaning',
          voiceScript: '도구와 재료가 준비되면 반죽을 시작할 수 있어요. 무엇이 필요할까요?',
          displayText: '반죽 전에 준비해요.',
          studentQuestion: '반죽 전에 필요한 것을 골라볼까요?',
          expectedResponseOptionIds: ['bowl', 'flour', 'prepare-tools']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '도구를 준비해요를 골라요. 어려우면 그릇과 밀가루 두 선택지만 볼게요.',
          displayText: '도구 준비를 연습해요.',
          studentQuestion: '도구를 준비할 때 할 행동을 골라볼까요?',
          expectedResponseOptionIds: ['prepare-tools']
        }
      ],
      practiceStep: {
        kind: 'choose',
        studentAction: '도구를 준비해요를 선택한다.',
        supportIfNeeded: '그릇과 밀가루 두 선택지만 제시한다.'
      },
      evidenceCandidate: '재료/도구 관찰, 준비 행동 표현',
      supportFallback: '실물 또는 사진으로 그릇과 밀가루를 보여주고 준비 행동을 고르게 한다.',
      teacherNextGuidance: '실물 또는 사진으로 그릇, 밀가루, 도구 고르기',
      aacOptionIds: ['bowl', 'flour', 'prepare-tools']
    },
    mix: {
      deliveredInfo: ['재료를 넣고 순서를 확인하며 반죽을 천천히 섞는다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '반죽과 재료가 보여요. 무엇을 섞고 있는지 골라볼까요?',
          displayText: '반죽과 재료를 봐요.',
          studentQuestion: '무엇을 섞고 있는지 골라볼까요?',
          expectedResponseOptionIds: ['dough', 'ingredients']
        },
        {
          purpose: 'meaning',
          voiceScript: '재료를 넣고 섞으면 반죽이 돼요. 어떤 순서로 해볼까요?',
          displayText: '넣고 섞는 순서를 봐요.',
          studentQuestion: '먼저 할 일을 골라볼까요?',
          expectedResponseOptionIds: ['ingredients', 'mix-action']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '반죽을 섞어요를 고르거나 재료 넣고 섞기 두 장 카드를 놓아봐요.',
          displayText: '두 단계로 연습해요.',
          studentQuestion: '반죽을 만들 때 할 행동을 골라볼까요?',
          expectedResponseOptionIds: ['mix-action']
        }
      ],
      practiceStep: {
        kind: 'sequence',
        studentAction: '반죽을 섞어요를 선택하거나 재료 넣고 섞기 2단계 카드를 배열한다.',
        supportIfNeeded: '넣기와 섞기 그림카드 두 장만 제시한다.'
      },
      evidenceCandidate: '행동 관찰, 간단한 순서 이해',
      supportFallback: '반죽과 재료 사진을 다시 보고 넣기 다음 섞기 카드로 연결한다.',
      teacherNextGuidance: '2단계 그림카드로 "넣기 -> 섞기" 배열 연습',
      aacOptionIds: ['dough', 'mix-action', 'ingredients']
    },
    bake: {
      deliveredInfo: ['오븐 주변에서는 기다리고 안전하게 조심한다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '오븐과 빵이 보여요. 뜨거운 곳을 골라볼까요?',
          displayText: '오븐과 빵을 살펴봐요.',
          studentQuestion: '뜨거운 곳을 하나 골라볼까요?',
          expectedResponseOptionIds: ['oven']
        },
        {
          purpose: 'meaning',
          voiceScript: '빵이 익는 동안 기다려요. 오븐 앞에서 무엇을 조심할까요?',
          displayText: '기다리고 조심해요.',
          studentQuestion: '오븐 앞에서 조심할 것을 골라볼까요?',
          expectedResponseOptionIds: ['oven', 'hot-safe']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '뜨거워서 조심해요를 골라요. 어려우면 장갑과 오븐 안전 그림을 함께 봐요.',
          displayText: '안전한 기다림을 연습해요.',
          studentQuestion: '오븐 앞에서 쓸 말을 골라볼까요?',
          expectedResponseOptionIds: ['hot-safe']
        }
      ],
      practiceStep: {
        kind: 'choose',
        studentAction: '뜨거워서 조심해요를 선택한다.',
        supportIfNeeded: '장갑과 오븐 안전 그림을 제시한다.'
      },
      evidenceCandidate: '안전 단서 관찰, 기다림/주의 표현',
      supportFallback: '안전 장갑 그림과 오븐 그림을 연결하고 기다림 카드를 고르게 한다.',
      teacherNextGuidance: '안전 장갑 그림과 오븐 그림을 연결하고 기다림 카드 선택',
      aacOptionIds: ['oven', 'bread', 'hot-safe']
    },
    clean: {
      deliveredInfo: ['빵을 만든 뒤 도구와 작업대를 정리해 다음 작업을 준비한다.'],
      turns: [
        {
          purpose: 'observe',
          voiceScript: '작업대와 도구가 보여요. 마지막에 정리할 것을 골라볼까요?',
          displayText: '마지막에 정리할 것을 봐요.',
          studentQuestion: '마지막에 정리할 것을 하나 골라볼까요?',
          expectedResponseOptionIds: ['baker-counter', 'baker-tools-clean']
        },
        {
          purpose: 'meaning',
          voiceScript: '정리하면 다음 작업을 시작하기 쉬워요. 무엇을 깨끗하게 할까요?',
          displayText: '다음 작업을 위해 정리해요.',
          studentQuestion: '깨끗하게 할 것을 골라볼까요?',
          expectedResponseOptionIds: ['baker-counter', 'baker-tools-clean', 'baker-clean']
        },
        {
          purpose: 'practice_or_support',
          voiceScript: '도구를 정리해요 또는 깨끗하게 마무리해요를 골라요. 어려우면 전과 뒤 사진을 봐요.',
          displayText: '마무리 정리를 연습해요.',
          studentQuestion: '마무리할 때 할 행동을 골라볼까요?',
          expectedResponseOptionIds: ['baker-tools-clean', 'baker-clean']
        }
      ],
      practiceStep: {
        kind: 'choose',
        studentAction: '도구를 정리해요 또는 깨끗하게 마무리해요를 선택한다.',
        supportIfNeeded: '정리 전과 뒤 사진을 비교하고 한 가지 행동만 선택하게 한다.'
      },
      evidenceCandidate: '마무리 루틴 관찰, 정리 행동 표현',
      supportFallback: '작업대 사진에서 닦기 또는 도구 모으기 중 하나를 고르게 한다.',
      teacherNextGuidance: '작업대 사진에서 닦기/도구 모으기 중 하나 선택',
      aacOptionIds: ['baker-counter', 'baker-tools-clean', 'baker-clean']
    }
  }
};
