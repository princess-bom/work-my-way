import { z } from 'zod';
import { DemoRunIdSchema } from './demo-api.js';

export const RealtimeSessionRequestSchema = z.object({ runId: DemoRunIdSchema }).strict();

export const RealtimeClientSecretSchema = z.object({
  value: z.string().min(10),
  expires_at: z.number().optional(),
  session: z.unknown().optional()
}).passthrough();
export type RealtimeClientSecret = z.infer<typeof RealtimeClientSecretSchema>;
