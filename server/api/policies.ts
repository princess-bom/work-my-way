export type RawTextGate = {
  responseOptIn: boolean;
  policyAllowsRawText: boolean;
  schoolAllowsExternalAi: boolean;
};

export type SanitizedTeacherAiContext = {
  context: Record<string, unknown>;
  redactedRawTextPaths: string[];
  blockedAudioPaths: string[];
};

const rawTextContextKeys = new Set(['rawtext', 'rawtranscript', 'transcript', 'originaltext', 'originaltranscript', 'studentrawtext']);
const rawAudioContextKeys = new Set(['audio', 'rawaudio', 'audioblob', 'audiobase64', 'voiceblob', 'recordingblob']);
const redactedRawTextValue = '[redacted:raw_text]';
const blockedRawAudioValue = '[blocked:raw_audio]';

export function canIncludeRawText(gate: RawTextGate) {
  return gate.responseOptIn && gate.policyAllowsRawText && gate.schoolAllowsExternalAi;
}

function normalizedContextKey(key: string) {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeContextValue(
  value: unknown,
  options: { allowRawText: boolean; path: string; redactedRawTextPaths: string[]; blockedAudioPaths: string[]; depth: number }
): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizeContextValue(item, {
        ...options,
        path: `${options.path}[${index}]`,
        depth: options.depth + 1
      })
    );
  }

  if (!isRecord(value)) return value;
  if (options.depth > 8) return {};

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = options.path ? `${options.path}.${key}` : key;
    const normalizedKey = normalizedContextKey(key);
    if (rawAudioContextKeys.has(normalizedKey)) {
      options.blockedAudioPaths.push(childPath);
      sanitized[key] = blockedRawAudioValue;
      continue;
    }
    if (rawTextContextKeys.has(normalizedKey) && !options.allowRawText) {
      options.redactedRawTextPaths.push(childPath);
      sanitized[key] = redactedRawTextValue;
      continue;
    }
    sanitized[key] = sanitizeContextValue(child, {
      ...options,
      path: childPath,
      depth: options.depth + 1
    });
  }
  return sanitized;
}

export function sanitizeTeacherAiContext(context: Record<string, unknown>, allowRawText: boolean): SanitizedTeacherAiContext {
  const redactedRawTextPaths: string[] = [];
  const blockedAudioPaths: string[] = [];
  return {
    context: sanitizeContextValue(context, {
      allowRawText,
      path: '',
      redactedRawTextPaths,
      blockedAudioPaths,
      depth: 0
    }) as Record<string, unknown>,
    redactedRawTextPaths,
    blockedAudioPaths
  };
}

export function deriveMasteryStatus(
  reviewStatus: 'needs_more_evidence' | 'evidence_sufficient' | 'teacher_confirmed' | 'ready_for_interview_practice' | 'not_ready',
  counts: { evidenceCount: number; supportCount: number }
) {
  if (reviewStatus === 'ready_for_interview_practice') return 'ready_for_interview_practice';
  if (reviewStatus === 'teacher_confirmed') return 'teacher_confirmed';
  if (reviewStatus === 'evidence_sufficient') return 'evidence_ready';
  if (reviewStatus === 'not_ready') return 'support_needed';
  return counts.supportCount > 0 ? 'support_needed' : 'practicing';
}

export function suggestionTypeForRequest(requestType: string) {
  switch (requestType) {
    case 'lesson_planning':
      return 'lesson_plan';
    case 'live_support':
      return 'live_support';
    case 'session_summary':
      return 'summary';
    case 'mastery_review':
      return 'mastery_evidence';
    case 'interview_preparation':
      return 'interview_prompt';
    default:
      return 'summary';
  }
}

export function policyColumnForRequest(requestType: string) {
  switch (requestType) {
    case 'lesson_planning':
      return 'allow_lesson_planning';
    case 'live_support':
      return 'allow_live_support';
    case 'session_summary':
      return 'allow_session_summary';
    case 'mastery_review':
      return 'allow_mastery_suggestions';
    case 'interview_preparation':
      return 'allow_interview_preparation';
    default:
      return null;
  }
}
