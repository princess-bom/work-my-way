import type { TeacherDecision, TeacherDecisionPersistence, TeacherLog } from './domain';

export const teacherDecisionOptions: Array<{ decision: TeacherDecision; label: string; description: string }> = [
  { decision: 'accepted', label: '근거 채택', description: '후보 근거로 두고 다음 수업에 연결합니다.' },
  { decision: 'edited', label: '수정해서 저장', description: '교사 메모를 반영해 후보 근거를 다듬습니다.' },
  { decision: 'dismissed', label: '보류하고 다시 보기', description: '후보 근거로 두지 않고 다음 관찰로 연결합니다.' }
];

export type PersistTeacherDecision = (
  log: TeacherLog,
  decision: TeacherDecision,
  note: string
) => Promise<{ persistedVia: TeacherDecisionPersistence; id?: string }>;

export function getDecisionLabel(decision: TeacherDecision) {
  return teacherDecisionOptions.find((option) => option.decision === decision)?.label ?? '교사 확인';
}

export function isBackendBoundTeacherLog(log: TeacherLog) {
  return Boolean(log.aiSuggestionId || log.masteryReviewTarget);
}

export function getTeacherPersistenceLabel(log: TeacherLog) {
  if (log.aiSuggestionId) return 'AI 지원 결정 API 연결';
  if (log.masteryReviewTarget) return '숙달 근거 검토 API 연결';
  return '로컬/데모 기록';
}

export function applyTeacherDecisionToLog(
  log: TeacherLog,
  decision: TeacherDecision,
  note: string,
  persistedVia: TeacherDecisionPersistence
): TeacherLog {
  const decisionLabel = getDecisionLabel(decision);
  const cleanNote = note.trim() || teacherDecisionOptions.find((option) => option.decision === decision)?.description || '교사 확인 기록';
  const persistenceFailed = persistedVia === 'failed';
  return {
    ...log,
    status: persistenceFailed ? '저장 오류' : decision === 'dismissed' ? '참고 기록' : '기록 완료',
    summary: persistenceFailed ? `${log.summary} 교사 조치 저장 대기: ${decisionLabel}.` : `${log.summary} 교사 조치: ${decisionLabel}.`,
    decisionHistory: [
      ...(log.decisionHistory ?? []),
      {
        decision,
        note: cleanNote,
        createdAt: new Date().toISOString(),
        persistedVia
      }
    ]
  };
}

export async function confirmTeacherLogDecision(
  log: TeacherLog,
  decision: TeacherDecision,
  note: string,
  persistDecision: PersistTeacherDecision
) {
  try {
    const result = await persistDecision(log, decision, note);
    return applyTeacherDecisionToLog(log, decision, note, result.persistedVia);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown';
    const decisionNote = `${note.trim() ? `${note.trim()} ` : ''}서버 저장 대기: ${errorMessage}`;
    return applyTeacherDecisionToLog(log, decision, decisionNote, 'failed');
  }
}
