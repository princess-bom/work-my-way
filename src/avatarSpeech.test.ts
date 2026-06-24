import { afterEach, describe, expect, it, vi } from 'vitest';
import { speakText } from './avatarSpeech';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubSpeechEnvironment() {
  const speak = vi.fn();
  const cancel = vi.fn();
  class SpeechSynthesisUtteranceStub {
    lang = '';
    rate = 1;
    constructor(public text: string) {}
  }

  vi.stubGlobal('SpeechSynthesisUtterance', SpeechSynthesisUtteranceStub);
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    speechSynthesis: { speak, cancel }
  });
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:avatar-speech',
    revokeObjectURL: () => undefined
  });

  return { speak, cancel };
}

describe('avatar speech playback fallback policy', () => {
  it('does not use browser TTS when provider speech fails for a live API student session', async () => {
    const speech = stubSpeechEnvironment();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'voice_provider_not_configured_or_disabled' }), { status: 200 })) as typeof fetch;

    await speakText('실제 제공자 음성만 사용합니다.', {
      sessionId: 'session-live-1',
      studentToken: 'student-token-1',
      allowBrowserFallback: false
    });

    expect(speech.speak).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'Avatar speech request/playback failed; browser speech fallback is disabled for this session.',
      expect.any(Error)
    );
  });

  it('keeps browser TTS fallback available only when explicitly allowed', async () => {
    const speech = stubSpeechEnvironment();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'session_context_required' }), { status: 401 })) as typeof fetch;

    await speakText('로컬 데모 안내입니다.', {
      sessionId: 'local-session-student-1',
      allowBrowserFallback: true
    });

    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledWith(
      'Avatar speech request/playback failed; falling back to browser speech synthesis.',
      expect.any(Error)
    );
  });
});
