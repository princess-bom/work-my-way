import { requestAvatarSpeech } from './avatarVoiceClient';
import type { AvatarSpeechRequestContext } from './avatarVoiceClient';

let activeSpeechAudio: HTMLAudioElement | null = null;
let activeSpeechUrl: string | null = null;
let speechRequestToken = 0;

function releaseActiveSpeechAudio() {
  if (activeSpeechAudio) {
    activeSpeechAudio.pause();
    activeSpeechAudio.removeAttribute('src');
    activeSpeechAudio.load();
    activeSpeechAudio = null;
  }
  if (activeSpeechUrl) {
    URL.revokeObjectURL(activeSpeechUrl);
    activeSpeechUrl = null;
  }
}

function speakTextWithBrowser(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}

function reportAvatarSpeechFallback(error: unknown) {
  if (typeof console === 'undefined') return;
  console.warn('Avatar speech request/playback failed; falling back to browser speech synthesis.', error);
}

function reportUnexpectedAvatarSpeechError(error: unknown): never {
  if (typeof console !== 'undefined') {
    console.error('Unexpected avatar speech failure; browser speech fallback is limited to request/playback errors.', error);
  }
  throw error;
}

function isExpectedAvatarSpeechFallbackError(error: unknown): error is Error {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) return true;
  return error instanceof Error;
}

export async function speakText(text: string, context?: AvatarSpeechRequestContext) {
  if (typeof window === 'undefined') return;
  const requestToken = (speechRequestToken += 1);
  releaseActiveSpeechAudio();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();

  try {
    const speech = await requestAvatarSpeech(text, 'alloy', context);
    if (requestToken !== speechRequestToken) {
      URL.revokeObjectURL(speech.url);
      return;
    }

    const audio = new Audio(speech.url);
    activeSpeechAudio = audio;
    activeSpeechUrl = speech.url;
    const cleanup = () => {
      if (activeSpeechAudio === audio) {
        activeSpeechAudio = null;
        activeSpeechUrl = null;
      }
      URL.revokeObjectURL(speech.url);
    };
    audio.addEventListener('ended', cleanup, { once: true });
    audio.addEventListener('error', cleanup, { once: true });
    await audio.play();
  } catch (error) {
    if (requestToken !== speechRequestToken) return;
    if (!isExpectedAvatarSpeechFallbackError(error)) reportUnexpectedAvatarSpeechError(error);
    releaseActiveSpeechAudio();
    reportAvatarSpeechFallback(error);
    speakTextWithBrowser(text);
  }
}
