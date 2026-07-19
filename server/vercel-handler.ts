type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type DemoAction = 'start' | 'state' | 'attempts' | 'teacher-decisions' | 'reset';
type DemoResponder = (action: DemoAction, body: unknown) => Promise<{ status: number; body: unknown }>;

export function handleDemoRequest(action: DemoAction, respond: DemoResponder) {
  return async function handler(request: ApiRequest, response: ApiResponse) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'method_not_allowed' });
      return;
    }
    const result = await respond(action, request.body ?? {});
    response.status(result.status).json(result.body);
  };
}
