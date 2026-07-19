import { z } from 'zod';

export const SupportActionSchema = z.enum(['visual', 'help', 'pause']);
export type SupportAction = z.infer<typeof SupportActionSchema>;

export const GoalContextSchema = z.object({
  targetSkill: z.string().min(1).max(100),
  observableCriterion: z.string().min(1).max(180)
}).strict();

export const SupportContextSchema = z.object({
  currentSupport: z.enum(['none', 'visual_choice', 'verbal_prompt', 'direct_model']),
  recentOutcome: z.enum(['not_attempted', 'criterion_met', 'criterion_not_met'])
}).strict();

export const SupportRequestSchema = z.object({
  action: SupportActionSchema,
  scene: z.object({
    jobTitle: z.string().min(1).max(80),
    sceneTitle: z.string().min(1).max(100),
    description: z.string().min(1).max(240),
    question: z.string().min(1).max(240)
  }).strict(),
  selectedChoice: z.string().max(120).optional(),
  goalContext: GoalContextSchema.optional(),
  supportContext: SupportContextSchema.optional()
}).strict();
export type SupportRequest = z.infer<typeof SupportRequestSchema>;

export const StudentChoiceSchema = z.object({
  label: z.string().min(1).max(60),
  visualCue: z.string().min(1).max(80)
});

export const SupportPacketSchema = z.object({
  studentMessage: z.string().min(1).max(140),
  studentChoices: z.array(StudentChoiceSchema).min(2).max(3),
  recommendedSupport: z.enum(['visual_choices', 'teacher_check', 'pause_and_resume']),
  teacherSignal: z.enum(['explicit_visual_request', 'explicit_help_request', 'explicit_pause_request']),
  teacherSummary: z.string().min(1).max(280),
  teacherNextStep: z.string().min(1).max(160),
  evidence: z.string().min(1).max(240),
  safety: z.object({
    noScoring: z.literal(true),
    noDiagnosis: z.literal(true),
    teacherReviewRequired: z.literal(true)
  })
});
export type SupportPacket = z.infer<typeof SupportPacketSchema>;

export const GenerationSchema = z.object({
  mode: z.enum(['live', 'safe-fallback', 'client-fallback', 'illustrative-sample']),
  model: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  responseId: z.string().optional(),
  reason: z.string().optional()
});

export const SupportPacketResponseSchema = SupportPacketSchema.extend({
  generation: GenerationSchema
});
export type SupportPacketResponse = z.infer<typeof SupportPacketResponseSchema>;

export const SUPPORT_PACKET_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'studentMessage',
    'studentChoices',
    'recommendedSupport',
    'teacherSignal',
    'teacherSummary',
    'teacherNextStep',
    'evidence',
    'safety'
  ],
  properties: {
    studentMessage: { type: 'string', minLength: 1, maxLength: 140 },
    studentChoices: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'visualCue'],
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 60 },
          visualCue: { type: 'string', minLength: 1, maxLength: 80 }
        }
      }
    },
    recommendedSupport: {
      type: 'string',
      enum: ['visual_choices', 'teacher_check', 'pause_and_resume']
    },
    teacherSignal: {
      type: 'string',
      enum: ['explicit_visual_request', 'explicit_help_request', 'explicit_pause_request']
    },
    teacherSummary: { type: 'string', minLength: 1, maxLength: 280 },
    teacherNextStep: { type: 'string', minLength: 1, maxLength: 160 },
    evidence: { type: 'string', minLength: 1, maxLength: 240 },
    safety: {
      type: 'object',
      additionalProperties: false,
      required: ['noScoring', 'noDiagnosis', 'teacherReviewRequired'],
      properties: {
        noScoring: { type: 'boolean', const: true },
        noDiagnosis: { type: 'boolean', const: true },
        teacherReviewRequired: { type: 'boolean', const: true }
      }
    }
  }
} as const;

const bannedLanguage = [
  /\bscore\b/i,
  /\brank(?:ing|ed)?\b/i,
  /\bbest\s+fit\b/i,
  /\bsuitab(?:le|ility)\b/i,
  /\bunsuitable\b/i,
  /\bdiagnos(?:e|ed|is|tic)\b/i,
  /\bdeficit\b/i,
  /\bfailure\b/i,
  /\bwrong\s+answer\b/i,
  /\blow\s+ability\b/i,
  /\bmaster(?:y|ed)\b/i
];

export function packetHasBannedLanguage(packet: SupportPacket): boolean {
  const text = [
    packet.studentMessage,
    ...packet.studentChoices.flatMap((choice) => [choice.label, choice.visualCue]),
    packet.teacherSummary,
    packet.teacherNextStep,
    packet.evidence
  ].join(' ');
  return bannedLanguage.some((pattern) => pattern.test(text));
}
