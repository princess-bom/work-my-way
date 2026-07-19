import type { SupportPacket, SupportPacketResponse, SupportRequest } from './support-schema.js';

export function createSafePacket(request: SupportRequest): SupportPacket {
  if (request.action === 'pause') {
    return {
      studentMessage: 'Taking a break is part of learning. We can return when you are ready.',
      studentChoices: [
        { label: 'Pause here', visualCue: 'A calm pause symbol' },
        { label: 'Return with a teacher', visualCue: 'A teacher and learner together' }
      ],
      recommendedSupport: 'pause_and_resume',
      teacherSignal: 'explicit_pause_request',
      teacherSummary: 'The learner explicitly requested a break during this scene.',
      teacherNextStep: 'Offer a pause and let the learner choose when to return.',
      evidence: 'Based only on the learner selecting Take a break in this scene.',
      safety: { noScoring: true, noDiagnosis: true, teacherReviewRequired: true }
    };
  }

  if (request.action === 'help') {
    return {
      studentMessage: 'We can ask for help and choose one small next step.',
      studentChoices: [
        { label: 'Ask a teacher', visualCue: 'A raised hand beside a teacher' },
        { label: 'Look at one example', visualCue: 'One clear example card' }
      ],
      recommendedSupport: 'teacher_check',
      teacherSignal: 'explicit_help_request',
      teacherSummary: 'The learner explicitly asked for help with this scene.',
      teacherNextStep: 'Check in and offer one concrete example before continuing.',
      evidence: 'Based only on the learner selecting I need help in this scene.',
      safety: { noScoring: true, noDiagnosis: true, teacherReviewRequired: true }
    };
  }

  return {
    studentMessage: 'Let’s make this one step smaller.',
    studentChoices: [
      { label: 'Check the return cart', visualCue: 'A cart holding returned books' },
      { label: 'Match the shelf label', visualCue: 'A book beside a shelf label' }
    ],
    recommendedSupport: 'visual_choices',
    teacherSignal: 'explicit_visual_request',
    teacherSummary: 'The learner explicitly asked to see this Library Assistant scene with visual choices.',
    teacherNextStep: 'Review the scene with two visual choices.',
    evidence: 'Based only on the learner’s explicit support request in this scene.',
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
