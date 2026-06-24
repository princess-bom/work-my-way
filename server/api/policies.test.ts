import { describe, expect, it } from 'vitest';
import { canIncludeRawText, deriveMasteryStatus, policyColumnForRequest, sanitizeTeacherAiContext, suggestionTypeForRequest } from './policies.ts';

describe('api policy helpers', () => {
  it('requires all raw-text gates before AI context can include original student text', () => {
    expect(
      canIncludeRawText({
        responseOptIn: true,
        policyAllowsRawText: true,
        schoolAllowsExternalAi: true
      })
    ).toBe(true);

    expect(
      canIncludeRawText({
        responseOptIn: true,
        policyAllowsRawText: false,
        schoolAllowsExternalAi: true
      })
    ).toBe(false);
  });

  it('keeps mastery status transitions under teacher review statuses', () => {
    expect(deriveMasteryStatus('evidence_sufficient', { evidenceCount: 2, supportCount: 0 })).toBe('evidence_ready');
    expect(deriveMasteryStatus('teacher_confirmed', { evidenceCount: 2, supportCount: 0 })).toBe('teacher_confirmed');
    expect(deriveMasteryStatus('ready_for_interview_practice', { evidenceCount: 2, supportCount: 0 })).toBe(
      'ready_for_interview_practice'
    );
    expect(deriveMasteryStatus('needs_more_evidence', { evidenceCount: 0, supportCount: 1 })).toBe('support_needed');
  });

  it('maps teacher AI request types to policy and suggestion fields', () => {
    expect(policyColumnForRequest('mastery_review')).toBe('allow_mastery_suggestions');
    expect(suggestionTypeForRequest('interview_preparation')).toBe('interview_prompt');
    expect(policyColumnForRequest('unknown')).toBeNull();
  });

  it('redacts caller-provided raw text in AI context unless raw-text gates have passed', () => {
    const sanitized = sanitizeTeacherAiContext(
      {
        selectedValue: '컵',
        rawText: '학생 원문',
        nested: { transcript: '학생 발화 기록' }
      },
      false
    );

    expect(sanitized.redactedRawTextPaths).toEqual(['rawText', 'nested.transcript']);
    expect(sanitized.blockedAudioPaths).toEqual([]);
    expect(sanitized.context).toEqual({
      selectedValue: '컵',
      rawText: '[redacted:raw_text]',
      nested: { transcript: '[redacted:raw_text]' }
    });
  });

  it('flags raw audio-like values so routes can block persistence', () => {
    const sanitized = sanitizeTeacherAiContext(
      {
        responseMode: 'speech',
        audioBlob: 'base64-audio-placeholder',
        nested: [{ audioBase64: 'another-placeholder' }]
      },
      true
    );

    expect(sanitized.blockedAudioPaths).toEqual(['audioBlob', 'nested[0].audioBase64']);
    expect(sanitized.context).toMatchObject({
      audioBlob: '[blocked:raw_audio]',
      nested: [{ audioBase64: '[blocked:raw_audio]' }]
    });
  });
});
