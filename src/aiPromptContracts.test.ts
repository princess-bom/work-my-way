import { describe, expect, it } from 'vitest';
import {
  createFallbackStudentSceneTurn,
  validateInterviewPracticeDraftOutput,
  validateMasteryEvidenceSuggestionOutput,
  validateStudentSceneTurnOutput,
  validateTeacherSummaryOutput,
  type StudentSceneTurnOutput
} from './aiPromptContracts';
import { getJob, getSceneAacOptions } from './data';

const scene = getJob('barista-aide').scenes[0];
const sceneAacOptions = getSceneAacOptions(scene);

const validSceneTurn: StudentSceneTurnOutput = {
  version: 'ai-mastery-scene-turn/v1',
  jobId: 'barista-aide',
  sceneId: 'prep',
  turnIndex: 1,
  turnPurpose: 'observe',
  voiceScript: '컵과 도구가 보이네요. 일을 시작하기 전에 무엇을 준비하는지 하나 골라볼까요?',
  displayText: '무엇을 준비하나요?',
  studentQuestion: '그림에서 보이는 준비 물건을 하나 골라볼까요?',
  aacOptions: sceneAacOptions,
  deliveredInfo: ['바리스타는 일을 시작하기 전에 컵과 도구를 확인한다.'],
  practiceStep: {
    kind: 'observe',
    studentAction: '컵, 도구, 준비 행동 중 하나를 선택한다.',
    supportIfNeeded: '그림 단서 2개를 다시 보여주고 선택지를 줄인다.'
  },
  expectedEvidence: [
    {
      criterionKey: 'observe_scene_target',
      evidenceLevelCandidate: 'emerging',
      evidenceStatusCandidate: 'needs_review',
      evidenceJson: {
        sceneTarget: '컵/도구/준비',
        responseMode: 'aac',
        turnPurpose: 'observe'
      }
    }
  ],
  supportRecommendation: {
    needed: false,
    kind: 'none',
    teacherNote: ''
  },
  teacherCapture: {
    studentSignal: '학생이 준비 물건을 선택했는지 확인 필요',
    nextInstructionHint: '실물 컵과 도구 사진을 놓고 준비 순서를 다시 연습한다.',
    requiresTeacherConfirmation: true
  },
  nextTurnPolicy: {
    advance: true,
    reason: '학생이 장면 단서를 선택하거나 지원을 요청하면 다음 의미 연결 턴으로 이동한다.',
    fallbackIfNoResponse: '선택지 2개로 줄이고 교사 도움 버튼을 노출한다.'
  },
  safetyFlags: []
};

describe('AI prompt contract validation', () => {
  it('accepts a valid student scene turn contract', () => {
    expect(validateStudentSceneTurnOutput(validSceneTurn)).toMatchObject({ ok: true });
    expect(validateStudentSceneTurnOutput(JSON.stringify(validSceneTurn))).toMatchObject({ ok: true });
  });

  it('rejects malformed JSON and non-object model output', () => {
    expect(validateStudentSceneTurnOutput('{"version":')).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: 'invalid_json' })])
    });
    expect(validateStudentSceneTurnOutput('[]')).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: 'invalid_object' })])
    });
  });

  it('rejects prompt-injection judgment copy in student-visible fields', () => {
    const invalid = {
      ...validSceneTurn,
      voiceScript: '정답을 잘했어요. 점수도 높아요.'
    };

    expect(validateStudentSceneTurnOutput(invalid)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: 'banned_student_copy' })])
    });
  });

  it('rejects turn 4 and a normal scene voiceScript over 120 characters', () => {
    const longVoice = '컵과 도구를 천천히 살펴보겠습니다. '.repeat(7);

    expect(validateStudentSceneTurnOutput({ ...validSceneTurn, turnIndex: 4 })).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: 'turn_index_out_of_range' })])
    });
    expect(validateStudentSceneTurnOutput({ ...validSceneTurn, voiceScript: longVoice })).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: 'voice_script_too_long' })])
    });
  });

  it('rejects more than one student question when detectable', () => {
    expect(
      validateStudentSceneTurnOutput({
        ...validSceneTurn,
        studentQuestion: '컵이 보이나요? 도구도 보이나요?'
      })
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: 'too_many_student_questions' })])
    });
  });

  it('rejects generic free-chat student questions that are not anchored to scene practice', () => {
    expect(
      validateStudentSceneTurnOutput({
        ...validSceneTurn,
        studentQuestion: '무엇이든 자유롭게 이야기해볼까요?'
      })
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: 'banned_open_chat_prompt' })])
    });
  });

  it('rejects teacher summaries with hidden scoring, ranking, or final judgment wording', () => {
    expect(
      validateTeacherSummaryOutput({
        version: 'ai-mastery-teacher-summary/v1',
        studentId: 'student-1',
        sessionId: 'session-1',
        jobId: 'barista-aide',
        summaryForTeacher: '직업 적합률 72%, 반 순위 3위입니다. AI final judgment: 바리스타 활동은 부족합니다.',
        sceneEvidence: [
          {
            sceneId: 'prep',
            observedSignal: '컵 선택',
            responseMode: 'aac',
            supportUsed: 'none',
            masteryEvidenceCandidate: 'emerging',
            teacherReviewNeeded: true
          }
        ],
        nextInstructionGuide: [
          {
            priority: 1,
            action: '실물 컵 사진과 도구 사진을 함께 본다.',
            reason: '교사 확인 뒤 다음 연습으로 연결한다.'
          }
        ],
        teacherDecisionRequired: ['evidenceLevel 확인'],
        mustNotShowToStudent: ['evidenceLevel']
      })
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: 'banned_teacher_judgment' })])
    });
  });

  it('keeps teacher summary and mastery suggestion decisions teacher-confirmed', () => {
    expect(
      validateTeacherSummaryOutput({
        version: 'ai-mastery-teacher-summary/v1',
        studentId: 'student-1',
        sessionId: 'session-1',
        jobId: 'barista-aide',
        summaryForTeacher: '학생은 AAC로 컵을 선택했습니다.',
        sceneEvidence: [
          {
            sceneId: 'prep',
            observedSignal: '컵 선택',
            responseMode: 'aac',
            supportUsed: 'none',
            masteryEvidenceCandidate: 'emerging',
            teacherReviewNeeded: true
          }
        ],
        nextInstructionGuide: [
          {
            priority: 1,
            action: '실물 컵 사진과 도구 사진을 함께 본다.',
            reason: '교사 확인 뒤 다음 연습으로 연결한다.'
          }
        ],
        teacherDecisionRequired: ['evidenceLevel 확인'],
        mustNotShowToStudent: ['evidenceLevel']
      })
    ).toMatchObject({ ok: true });

    expect(
      validateMasteryEvidenceSuggestionOutput({
        version: 'ai-mastery-evidence-suggestion/v1',
        suggestionType: 'mastery_evidence',
        criterionKey: 'observe_scene_target',
        candidateLevel: 'independent',
        candidateStatus: 'observed',
        evidenceSummary: '학생이 AAC로 컵을 선택했다.',
        supportSummary: '지원 없음',
        teacherReviewQuestion: '이 선택을 장면 단서 관찰 근거로 인정할까요?',
        recommendedNextInstruction: '같은 장면에서 물건 2개를 고른다.',
        teacherFinalDecisionRequired: false
      })
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: 'teacher_confirmation_required' })])
    });
  });

  it('rejects interview readiness drafts that make the final AI decision', () => {
    expect(
      validateInterviewPracticeDraftOutput({
        version: 'ai-interview-practice-draft/v1',
        jobId: 'barista-aide',
        readinessDecision: 'ready_for_interview_practice',
        practicePrompt: '카페에서 먼저 준비하는 것을 골라볼까요?',
        allowedStudentResponses: ['컵', '도구', '준비해요', '도움이 필요해요'],
        teacherSetup: '실물 사진 3장을 준비한다.',
        notAPlacementDecision: true
      })
    ).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([expect.objectContaining({ code: 'teacher_confirmation_required' })])
    });
  });

  it('creates deterministic safe fallback with the scene AAC options after validation failure', () => {
    const fallback = createFallbackStudentSceneTurn({
      jobId: 'barista-aide',
      scene,
      turnIndex: 2,
      reason: 'validation_failed'
    });

    expect(fallback).toMatchObject({
      version: 'ai-mastery-scene-turn/v1',
      jobId: 'barista-aide',
      sceneId: 'prep',
      turnIndex: 2,
      turnPurpose: 'meaning',
      aacOptions: sceneAacOptions,
      teacherCapture: expect.objectContaining({ requiresTeacherConfirmation: true }),
      safetyFlags: ['fallback:validation_failed']
    });
    expect(fallback.voiceScript.length).toBeLessThanOrEqual(120);
    expect(validateStudentSceneTurnOutput(fallback)).toMatchObject({ ok: true });
  });
});
