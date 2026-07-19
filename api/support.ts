import { supportHttpResponse } from '../server/http';

type ApiRequest = {
  method?: string;
  body?: unknown;
};

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

  const result = await supportHttpResponse(request.body, {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL
  });
  response.status(result.status).json(result.body);
}
