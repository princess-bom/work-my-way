import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { avatarVoiceHandler } from './server/avatarVoiceApi';

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

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

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
