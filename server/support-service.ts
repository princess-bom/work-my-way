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

export const SUPPORT_SYSTEM_PROMPT = `당신은 교사가 확인하는 직업 탐구 반복학습 앱 '꿈이든 내일탐색'의 도움 조정 계층입니다.

역할은 좁습니다. 학생이 그림 도움, 도움 요청, 쉬기를 명시적으로 선택했을 때만 짧은 학생용 안내와 사실에 근거한 교사용 초안을 만듭니다.

반드시 지킬 규칙:
- 점수, 순위, 직업 적합성, 진단, 능력 추론, 직업 추천을 하지 않습니다.
- 숙달을 결정하거나 주장하지 않습니다. 숙달은 별도의 결정 규칙과 교사 확인으로만 처리됩니다.
- 현재 장면에서 명시적으로 보이는 행동만 설명합니다.
- 쉬운 한국어를 사용하고 학생용 문장은 한 문장으로 짧게 씁니다.
- 구체적인 선택지를 두세 개 제공합니다.
- 감정, 장애, 선호, 이전 행동을 만들어 내지 않습니다.
- 교사가 최종 확인자입니다.
- 세 개의 안전 플래그는 모두 true여야 합니다.`;

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
        language: 'ko'
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
