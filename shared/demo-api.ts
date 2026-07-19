import { z } from 'zod';
import { DemoStateSchema } from './demo-state.js';

export const PersistenceModeSchema = z.enum(['postgres', 'memory_fallback']);
export type PersistenceMode = z.infer<typeof PersistenceModeSchema>;

export const DemoRunIdSchema = z.string().uuid();

export const DemoEnvelopeSchema = z.object({
  runId: DemoRunIdSchema,
  state: DemoStateSchema,
  mastery: z.object({
    status: z.enum(['in_progress', 'ready_for_teacher_review', 'mastered']),
    evidenceAttemptIds: z.tuple([z.string(), z.string()]).nullable()
  }),
  persistence: PersistenceModeSchema,
  expiresAt: z.string().datetime()
});
export type DemoEnvelope = z.infer<typeof DemoEnvelopeSchema>;

export const RunRequestSchema = z.object({ runId: DemoRunIdSchema }).strict();
export const DemoAttemptInputSchema = z.object({
  id: z.string().min(1).max(120),
  selectedChoiceId: z.enum(['return-cart', 'shelf-now', 'front-desk']),
  supportRequest: z.enum(['show', 'help', 'break']).nullable()
}).strict();
export type DemoAttemptInput = z.infer<typeof DemoAttemptInputSchema>;

export const AttemptRequestSchema = z.object({ runId: DemoRunIdSchema, attempt: DemoAttemptInputSchema }).strict();
export const DemoTeacherDecisionInputSchema = z.object({
  id: z.string().min(1).max(120),
  decision: z.literal('confirm_mastery')
}).strict();
export type DemoTeacherDecisionInput = z.infer<typeof DemoTeacherDecisionInputSchema>;

export const TeacherDecisionRequestSchema = z.object({
  runId: DemoRunIdSchema,
  decision: DemoTeacherDecisionInputSchema
}).strict();
