import { createFallbackResponse } from '../shared/fallback';
import {
  SupportPacketResponseSchema,
  type SupportPacketResponse,
  type SupportRequest
} from '../shared/support-schema';
import {
  DemoEnvelopeSchema,
  type DemoEnvelope
} from '../shared/demo-api';
import type { DemoAttemptInput } from '../shared/demo-api';
import type { DemoTeacherDecisionInput } from '../shared/demo-api';

export const DEMO_RUN_ID_KEY = 'work-my-way.synthetic-demo.run-id';

export async function requestSupportPacket(request: SupportRequest): Promise<SupportPacketResponse> {
  try {
    const response = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Support service returned ${response.status}.`);
    }

    return SupportPacketResponseSchema.parse(await response.json());
  } catch (error) {
    return createFallbackResponse(
      request,
      'client-fallback',
      error instanceof Error ? error.message : 'The support service could not be reached.'
    );
  }
}

async function requestDemo(path: string, body: unknown): Promise<DemoEnvelope> {
  const response = await fetch(`/api/demo/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Demo service returned ${response.status}.`);
  return DemoEnvelopeSchema.parse(await response.json());
}

export function startDemoRun() {
  return requestDemo('start', {});
}

export function getDemoRun(runId: string) {
  return requestDemo('state', { runId });
}

export function recordDemoAttempt(runId: string, attempt: DemoAttemptInput) {
  return requestDemo('attempts', { runId, attempt });
}

export function recordDemoTeacherDecision(runId: string, decision: DemoTeacherDecisionInput) {
  return requestDemo('teacher-decisions', { runId, decision });
}

export function resetDemoRun(runId: string) {
  return requestDemo('reset', { runId });
}
