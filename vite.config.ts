import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { avatarVoiceHandler } from './server/avatarVoiceApi';

const referenceOpenAiEnvPath = '/Users/eddy/Documents/New project 12/.env.local';

function voiceApiPlugin(): Plugin {
  return {
    name: 'mvp-avatar-voice-api',
    configureServer(server) {
      server.middlewares.use('/api/avatar/speak', avatarVoiceHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/avatar/speak', avatarVoiceHandler);
    }
  };
}

function readLocalEnvFile(fileName: string): Record<string, string> {
  if (!existsSync(fileName)) return {};
  return Object.fromEntries(
    readFileSync(fileName, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
      .filter(([key, value]) => key.startsWith('OPENAI_') && value)
  );
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  for (const [key, value] of Object.entries(readLocalEnvFile(referenceOpenAiEnvPath))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [react(), tailwindcss(), voiceApiPlugin()],
    server: {
      host: '0.0.0.0'
    },
    preview: {
      host: '0.0.0.0'
    }
  };
});
