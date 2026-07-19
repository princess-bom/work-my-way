import type { SupportPacket, SupportPacketResponse, SupportRequest } from './support-schema.js';

export function createSafePacket(request: SupportRequest): SupportPacket {
  if (request.action === 'pause') {
    return {
      studentMessage: '잠시 쉬어도 괜찮아요. 준비되면 다시 시작해요.',
      studentChoices: [
        { label: '여기서 쉬기', visualCue: '차분한 쉬기 표시' },
        { label: '선생님과 다시 하기', visualCue: '선생님과 학생이 함께 있는 그림' }
      ],
      recommendedSupport: 'pause_and_resume',
      teacherSignal: 'explicit_pause_request',
      teacherSummary: '학생이 현재 장면에서 쉬기를 직접 선택했습니다.',
      teacherNextStep: '쉬는 시간을 제공하고 다시 시작할 때를 학생이 선택하도록 합니다.',
      evidence: '현재 장면에서 학생이 쉬기 버튼을 선택한 사실만 반영했습니다.',
      safety: { noScoring: true, noDiagnosis: true, teacherReviewRequired: true }
    };
  }

  if (request.action === 'help') {
    return {
      studentMessage: '도움을 요청하고 작은 단계 하나를 골라봐요.',
      studentChoices: [
        { label: '선생님께 물어보기', visualCue: '선생님 옆에서 손을 든 그림' },
        { label: '예시 하나 보기', visualCue: '분명한 예시 카드 한 장' }
      ],
      recommendedSupport: 'teacher_check',
      teacherSignal: 'explicit_help_request',
      teacherSummary: '학생이 현재 장면에서 도움을 직접 요청했습니다.',
      teacherNextStep: '계속하기 전에 구체적인 예시 하나를 제공합니다.',
      evidence: '현재 장면에서 학생이 도움 버튼을 선택한 사실만 반영했습니다.',
      safety: { noScoring: true, noDiagnosis: true, teacherReviewRequired: true }
    };
  }

  return {
    studentMessage: '한 단계만 작게 나누어 그림으로 살펴봐요.',
    studentChoices: [
      { label: '반납 카트 보기', visualCue: '반납된 책이 담긴 카트 그림' },
      { label: '책 라벨 보기', visualCue: '책과 책장 라벨이 함께 있는 그림' }
    ],
    recommendedSupport: 'visual_choices',
    teacherSignal: 'explicit_visual_request',
    teacherSummary: '학생이 도서관 장면을 그림 선택으로 보고 싶다고 요청했습니다.',
    teacherNextStep: '두 개의 그림 선택으로 현재 장면을 다시 살펴봅니다.',
    evidence: '현재 장면에서 학생이 그림 도움을 요청한 사실만 반영했습니다.',
    safety: { noScoring: true, noDiagnosis: true, teacherReviewRequired: true }
  };
}

export function createFallbackResponse(
  request: SupportRequest,
  mode: SupportPacketResponse['generation']['mode'],
  reason: string,
  latencyMs = 0
): SupportPacketResponse {
  return {
    ...createSafePacket(request),
    generation: {
      mode,
      model: 'gpt-5.6-luna',
      latencyMs,
      reason
    }
  };
}
