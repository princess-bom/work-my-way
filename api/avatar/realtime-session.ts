import { realtimeHttpResponse } from '../../server/realtime-service.js';

type ApiRequest = { method?: string; body?: unknown; headers?: { origin?: string; host?: string } };
type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const origin = request.headers?.origin;
  const host = request.headers?.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        response.status(403).json({ error: 'origin_not_allowed' });
        return;
      }
    } catch {
      response.status(403).json({ error: 'origin_not_allowed' });
      return;
    }
  }
  const result = await realtimeHttpResponse(request.body ?? {}, {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_REALTIME_MODEL
  });
  response.status(result.status).json(result.body);
}
