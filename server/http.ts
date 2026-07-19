import { createSupportPacket } from './support-service';
import { SupportRequestSchema } from '../shared/support-schema';

export async function supportHttpResponse(body: unknown, env: { apiKey?: string; model?: string } = {}) {
  try {
    const request = SupportRequestSchema.parse(body);
    const packet = await createSupportPacket(request, {
      apiKey: env.apiKey,
      model: env.model
    });
    return { status: 200, body: packet };
  } catch (error) {
    return {
      status: 400,
      body: {
        error: 'invalid_request',
        message: error instanceof Error ? error.message : 'The request could not be validated.'
      }
    };
  }
}
