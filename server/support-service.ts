import OpenAI from 'openai';
import { createFallbackResponse } from '../shared/fallback.js';
import {
  packetHasBannedLanguage,
  SUPPORT_PACKET_JSON_SCHEMA,
  SupportPacketSchema,
  SupportRequestSchema,
  type SupportPacketResponse,
  type SupportRequest
} from '../shared/support-schema.js';

export const SUPPORT_SYSTEM_PROMPT = `You are the adaptation layer for Work, My Way, a teacher-guided vocational mastery-learning app for students who benefit from additional communication and learning support.

Your role is narrow: respond only to an explicit learner request for visual support, help, or a break. Produce one short student-facing adaptation and one factual teacher draft.

Hard rules:
- Never score, rank, assess suitability, diagnose, infer ability, or recommend a career.
- Never decide or claim mastery. Mastery is calculated from recorded attempts and confirmed by a teacher outside this service.
- Describe only the explicit action in the current scene.
- Use plain English. The student message should be one sentence with about 6 to 14 words.
- Offer two or three concrete choices.
- Do not invent emotions, disabilities, preferences, or prior behavior.
- The teacher must remain the final reviewer.
- All three safety flags must be true.`;

type ResponseClient = {
  responses: {
    create: (
      input: OpenAI.Responses.ResponseCreateParamsNonStreaming
    ) => Promise<{ id?: string; output_text?: string }>;
  };
};

type ServiceOptions = {
  apiKey?: string;
  model?: string;
  client?: ResponseClient;
};

export async function createSupportPacket(
  rawRequest: SupportRequest,
  options: ServiceOptions = {}
): Promise<SupportPacketResponse> {
  const request = SupportRequestSchema.parse(rawRequest);
  const startedAt = Date.now();
  const model = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-5.6-luna';
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey && !options.client) {
    return createFallbackResponse(request, 'safe-fallback', 'OpenAI API key is not configured.');
  }

  try {
    const client: ResponseClient = options.client ?? new OpenAI({
      apiKey,
      timeout: 12_000,
      maxRetries: 1
    });

    const response = await client.responses.create({
      model,
      reasoning: { effort: 'low' },
      instructions: SUPPORT_SYSTEM_PROMPT,
      input: JSON.stringify({
        supportAction: request.action,
        scene: request.scene,
        selectedChoice: request.selectedChoice ?? null,
        goalContext: request.goalContext ?? null,
        supportContext: request.supportContext ?? null,
        language: 'en'
      }),
      max_output_tokens: 600,
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'adaptive_support_packet',
          strict: true,
          schema: SUPPORT_PACKET_JSON_SCHEMA
        }
      }
    });

    if (!response.output_text) {
      throw new Error('The model returned no structured output.');
    }

    const packet = SupportPacketSchema.parse(JSON.parse(response.output_text));
    if (packetHasBannedLanguage(packet)) {
      throw new Error('The model output used prohibited evaluative language.');
    }

    const result: SupportPacketResponse = {
      ...packet,
      generation: {
        mode: 'live',
        model,
        latencyMs: Date.now() - startedAt,
        responseId: response.id
      }
    };

    console.info('[support-packet]', {
      action: request.action,
      mode: result.generation.mode,
      model,
      latencyMs: result.generation.latencyMs
    });
    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown model error.';
    const result = createFallbackResponse(request, 'safe-fallback', reason, Date.now() - startedAt);
    console.warn('[support-packet]', {
      action: request.action,
      mode: result.generation.mode,
      model,
      latencyMs: result.generation.latencyMs
    });
    return result;
  }
}
