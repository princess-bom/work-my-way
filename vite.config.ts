import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { supportHttpResponse } from './server/http';

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
          const chunks: Buffer[] = [];
          let bytes = 0;
          for await (const chunk of request) {
            const buffer = Buffer.from(chunk);
            bytes += buffer.length;
            if (bytes > 32_000) throw new Error('Request body is too large.');
            chunks.push(buffer);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), supportApiPlugin(env)],
    build: {
      sourcemap: true
    },
    test: {
      include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'shared/**/*.test.ts']
    }
  };
});
