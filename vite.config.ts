import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { supportHttpResponse } from './server/http';
import { demoHttpResponse } from './server/demo-http';
import { realtimeHttpResponse } from './server/realtime-service';

async function readJsonBody(request: AsyncIterable<unknown>) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array);
    bytes += buffer.length;
    if (bytes > 32_000) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) as unknown : {};
}

function supportApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'work-my-way-support-api',
    configureServer(server) {
      server.middlewares.use('/api/support', async (request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');

        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: 'method_not_allowed' }));
          return;
        }

        try {
          const body = await readJsonBody(request);
          const result = await supportHttpResponse(body, {
            apiKey: env.OPENAI_API_KEY,
            model: env.OPENAI_MODEL
          });
          response.statusCode = result.status;
          response.end(JSON.stringify(result.body));
        } catch (error) {
          response.statusCode = 400;
          response.end(JSON.stringify({
            error: 'invalid_request',
            message: error instanceof Error ? error.message : 'Invalid request.'
          }));
        }
      });
    }
  };
}

function demoApiPlugin(): Plugin {
  const actions = new Set(['start', 'state', 'attempts', 'teacher-decisions', 'reset'] as const);
  return {
    name: 'work-my-way-demo-api',
    configureServer(server) {
      server.middlewares.use('/api/demo', async (request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        const action = request.url?.split('?')[0].replace(/^\//, '') ?? '';
        if (request.method !== 'POST' || !actions.has(action as 'start')) {
          response.statusCode = request.method === 'POST' ? 404 : 405;
          response.end(JSON.stringify({ error: request.method === 'POST' ? 'not_found' : 'method_not_allowed' }));
          return;
        }
        try {
          const result = await demoHttpResponse(
            action as 'start' | 'state' | 'attempts' | 'teacher-decisions' | 'reset',
            await readJsonBody(request)
          );
          response.statusCode = result.status;
          response.end(JSON.stringify(result.body));
        } catch (error) {
          response.statusCode = 400;
          response.end(JSON.stringify({
            error: 'invalid_request',
            message: error instanceof Error ? error.message : 'Invalid request.'
          }));
        }
      });
    }
  };
}

function realtimeApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'work-my-way-realtime-api',
    configureServer(server) {
      server.middlewares.use('/api/avatar/realtime-session', async (request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        if (request.method !== 'POST') {
          response.statusCode = 405;
          response.end(JSON.stringify({ error: 'method_not_allowed' }));
          return;
        }
        const result = await realtimeHttpResponse(await readJsonBody(request), {
          apiKey: env.OPENAI_API_KEY,
          model: env.OPENAI_REALTIME_MODEL
        });
        response.statusCode = result.status;
        response.end(JSON.stringify(result.body));
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), supportApiPlugin(env), demoApiPlugin(), realtimeApiPlugin(env)],
    build: {
      sourcemap: true
    },
    test: {
      include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'shared/**/*.test.ts']
    }
  };
});
