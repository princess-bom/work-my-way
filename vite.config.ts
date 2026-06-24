import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { avatarRealtimeSessionHandler, avatarVoiceHandler } from './server/avatarVoiceApi.ts';

function voiceApiPlugin(): Plugin {
  return {
    name: 'mvp-avatar-voice-api',
    configureServer(server) {
      server.middlewares.use('/api/avatar/speak', avatarVoiceHandler);
      server.middlewares.use('/api/avatar/realtime-session', avatarRealtimeSessionHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/avatar/speak', avatarVoiceHandler);
      server.middlewares.use('/api/avatar/realtime-session', avatarRealtimeSessionHandler);
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
