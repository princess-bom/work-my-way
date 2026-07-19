import { createHash } from 'node:crypto';
import { RealtimeClientSecretSchema, RealtimeSessionRequestSchema } from '../shared/realtime-schema.js';
import { demoService } from './demo-service.js';

export const REALTIME_MODEL = 'gpt-realtime-2.1-mini';

export const REALTIME_INSTRUCTIONS = `당신은 발달장애 학생을 위한 직업 탐구 학습 도우미 '이든'입니다.

현재 장면은 도서관에서 반납된 책을 어디에 먼저 놓는지 살펴보는 가상 학습 장면입니다.

반드시 지킬 규칙:
- 한국어 존댓말을 사용합니다.
- 한 번에 짧은 두 문장과 질문 하나만 말합니다.
- 현재 화면에 보이는 책, 반납 카트, 책장만 이야기합니다.
- 정답을 먼저 말하지 않고 학생이 장면을 관찰하도록 돕습니다.
- 점수, 진단, 능력, 직업 적합성, 숙달 여부를 판단하거나 언급하지 않습니다.
- 학생의 감정, 장애, 선호, 과거 행동을 추측하지 않습니다.
- 학생이 쉬고 싶다고 하면 쉬어도 괜찮다고 말하고 대화를 멈춥니다.
- 말하기는 선택이며 화면의 그림 버튼으로 대답해도 된다고 알려줍니다.
- 면접 연습으로 넘어가지 않습니다.
- 개인 정보나 실명, 학교, 진단명을 묻지 않습니다.`;

const mintHistory = new Map<string, number[]>();
const MINT_WINDOW_MS = 10 * 60 * 1000;
const MAX_MINTS_PER_RUN = 4;

function enforceSyntheticRunLimit(runId: string) {
  const current = Date.now();
  const recent = (mintHistory.get(runId) ?? []).filter((timestamp) => current - timestamp < MINT_WINDOW_MS);
  if (recent.length >= MAX_MINTS_PER_RUN) throw new Error('Realtime session limit reached for this synthetic demo run.');
  mintHistory.set(runId, [...recent, current]);
}

type RealtimeOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  validateRun?: (runId: string) => Promise<unknown>;
};

export async function createRealtimeClientSecret(rawRequest: unknown, options: RealtimeOptions = {}) {
  const request = RealtimeSessionRequestSchema.parse(rawRequest);
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key is not configured.');

  await (options.validateRun ?? ((runId) => demoService.get(runId)))(request.runId);
  enforceSyntheticRunLimit(request.runId);
  const safetyIdentifier = createHash('sha256')
    .update(`work-my-way-synthetic:${request.runId}`)
    .digest('hex');

  const response = await (options.fetchImpl ?? fetch)('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': safetyIdentifier
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: options.model ?? process.env.OPENAI_REALTIME_MODEL ?? REALTIME_MODEL,
        instructions: REALTIME_INSTRUCTIONS,
        audio: {
          output: { voice: 'marin' }
        }
      }
    })
  });

  const body = await response.json() as unknown;
  if (!response.ok) {
    const message = typeof body === 'object' && body && 'error' in body
      ? JSON.stringify((body as { error: unknown }).error)
      : `OpenAI Realtime returned ${response.status}.`;
    throw new Error(message);
  }
  return RealtimeClientSecretSchema.parse(body);
}

export async function realtimeHttpResponse(body: unknown, options: RealtimeOptions = {}) {
  try {
    return { status: 200, body: await createRealtimeClientSecret(body, options) };
  } catch (error) {
    return {
      status: 400,
      body: {
        error: 'realtime_session_unavailable',
        message: error instanceof Error ? error.message : 'Realtime session could not be created.'
      }
    };
  }
}
