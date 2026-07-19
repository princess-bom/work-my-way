import { createFallbackResponse } from '../shared/fallback';
import {
  SupportPacketResponseSchema,
  type SupportPacketResponse,
  type SupportRequest
} from '../shared/support-schema';

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
