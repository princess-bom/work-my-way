import {
  createFallbackStudentSceneTurn,
  validateStudentSceneTurnOutput,
  type StudentSceneTurnOutput
} from './aiPromptContracts';
import { getJob, getSceneAacOptions } from './data';
import type { AacOption, JobId } from './domain';
import { sceneConversationPlans } from './sceneConversationPlans';

type Scene = ReturnType<typeof getJob>['scenes'][number];

export function getSceneTurnIndex(sceneTurnCount: number): 1 | 2 | 3 {
  if (sceneTurnCount >= 2) return 3;
  if (sceneTurnCount === 1) return 2;
  return 1;
}

export function getCappedSceneTurnCount(sceneTurnCount: number) {
  return Math.min(Math.max(sceneTurnCount, 0), 3);
}

export function getGuardedStudentSceneTurn(
  jobId: JobId,
  scene: Scene,
  sceneTurnCount: number
): StudentSceneTurnOutput {
  const turnIndex = getSceneTurnIndex(sceneTurnCount);
  const plan = sceneConversationPlans[jobId]?.[scene.id];
  const plannedTurn = plan?.turns[turnIndex - 1];

  if (!plan || !plannedTurn) {
    return createFallbackStudentSceneTurn({ jobId, scene, turnIndex, reason: 'missing_scene_plan' });
  }

  const sceneAacOptions = getSceneAacOptions(scene);
  const expectedIds = new Set(plannedTurn.expectedResponseOptionIds);
  const turnAacOptions = sceneAacOptions.filter((option) => expectedIds.has(option.id));
  const aacOptions = turnAacOptions.length ? turnAacOptions : sceneAacOptions;
  const output: StudentSceneTurnOutput = {
    version: 'ai-mastery-scene-turn/v1',
    jobId,
    sceneId: scene.id,
    turnIndex,
    turnPurpose: plannedTurn.purpose,
    voiceScript: plannedTurn.voiceScript,
    displayText: plannedTurn.displayText,
    studentQuestion: plannedTurn.studentQuestion,
    aacOptions,
    deliveredInfo: plan.deliveredInfo,
    practiceStep: plan.practiceStep,
    expectedEvidence: [
      {
        criterionKey: 'scene_participation',
        evidenceLevelCandidate: 'emerging',
        evidenceStatusCandidate: 'needs_review',
        evidenceJson: {
          sceneId: scene.id,
          responseMode: 'aac_or_touch',
          turnPurpose: plannedTurn.purpose,
          expectedOptionIds: plannedTurn.expectedResponseOptionIds
        }
      }
    ],
    supportRecommendation: {
      needed: false,
      kind: 'none',
      teacherNote: ''
    },
    teacherCapture: {
      studentSignal: `${scene.label.replace(/^\d+\s*/, '')} 장면에서 AAC 또는 터치 선택 확인 필요`,
      nextInstructionHint: plan.teacherNextGuidance,
      requiresTeacherConfirmation: true
    },
    nextTurnPolicy: {
      advance: turnIndex < 3,
      reason: turnIndex < 3 ? '학생이 선택하면 다음 장면 대화 턴으로 이어간다.' : '세 번째 턴 뒤에는 정리로 이동할 수 있다.',
      fallbackIfNoResponse: plan.supportFallback
    },
    safetyFlags: []
  };
  const result = validateStudentSceneTurnOutput(output);
  return result.ok ? result.value : createFallbackStudentSceneTurn({ jobId, scene, turnIndex, reason: 'validation_failed' });
}

export function createGuardedSceneReply(input: {
  jobId: JobId;
  scene: Scene;
  option: AacOption;
  sceneTurnCount: number;
}) {
  if (input.option.supportAction === 'help') return '선생님께 도움을 요청했습니다. 같은 장면에서 천천히 이어가겠습니다.';
  if (input.option.supportAction === 'pause') return '잠시 쉬어도 괜찮습니다. 준비되면 선생님과 함께 이어가겠습니다.';
  if (input.option.supportAction === 'visual') return '그림 자료로 같은 장면을 다시 살펴보겠습니다.';
  if (input.option.supportAction === 'replay') return '이든의 말을 다시 들으며 같은 장면을 살펴보겠습니다.';

  const nextTurnCount = getCappedSceneTurnCount(input.sceneTurnCount + 1);
  const nextTurn = getGuardedStudentSceneTurn(input.jobId, input.scene, nextTurnCount);
  if (input.sceneTurnCount >= 2) {
    return `${input.option.value}라고 표현했습니다. 이 장면은 여기까지 살펴봤습니다. 필요하면 다시 듣기나 선생님 도움을 사용할 수 있습니다.`;
  }
  return `${input.option.value}라고 표현했습니다. ${nextTurn.displayText}`;
}
