import { afterEach, describe, expect, it } from 'vitest';
import { buildOpenAISpeechRequestBody, normalizeAvatarVoicePayload } from './avatarVoiceApi';

const originalEnv = {
  OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL,
  OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE,
  OPENAI_TTS_INSTRUCTIONS: process.env.OPENAI_TTS_INSTRUCTIONS
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('avatar voice api', () => {
  it('normalizes OpenAI voice requests without requiring client-side secrets', () => {
    const payload = normalizeAvatarVoicePayload({
      provider: 'openai',
      input: '  오늘은\n바리스타의 하루를   살펴볼게요.  ',
      voice: 'alloy'
    });

    expect(payload).toEqual({
      provider: 'openai',
      input: '오늘은 바리스타의 하루를 살펴볼게요.',
      voice: 'alloy'
    });
    expect(normalizeAvatarVoicePayload({ provider: 'higgs', input: '안녕' })).toBeNull();
  });

  it('builds the same OpenAI TTS request shape used by the reference app', () => {
    process.env.OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
    process.env.OPENAI_TTS_VOICE = 'marin';
    process.env.OPENAI_TTS_INSTRUCTIONS = '한국어로 차분하고 또렷하게 읽어주세요.';

    expect(
      buildOpenAISpeechRequestBody({
        provider: 'openai',
        input: '천천히 들어볼게요.'
      })
    ).toEqual({
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      input: '천천히 들어볼게요.',
      instructions: '한국어로 차분하고 또렷하게 읽어주세요.',
      response_format: 'mp3'
    });
  });
});
