import { describe, expect, it } from 'vitest';
import { createRecord, mockCoachGateway } from './adapters';
import { getIntroContent, getNextIntroJobId, hasBannedCopy } from './App';
import { getSceneImage } from './assets';
import { getJob, getSceneNarration, initialState, jobs } from './data';

describe('student exploration copy and records', () => {
  it('flags teacher-dashboard ranking or scoring copy as banned', () => {
    expect(hasBannedCopy('학생 점수와 적합률을 보여줍니다')).toBe(true);
    expect(hasBannedCopy('학생의 표현을 다음 수업 지원으로 연결합니다')).toBe(false);
  });

  it('creates a student-facing exploration record from the selected scene', () => {
    const job = getJob('library-aide');
    const record = createRecord(
      {
        ...initialState,
        selectedJobId: 'library-aide',
        selectedSceneId: 'guide',
        selectedThought: '더 알아볼래요'
      },
      job
    );

    expect(record.jobTitle).toBe('도서관 사서');
    expect(record.memorableScene).toBe('이용 안내');
    expect(record.studentThought).toBe('더 알아볼래요');
    expect(record.edenNote).toContain('다음 수업');
  });

  it('keeps the landing-selected job when entering intro directly', () => {
    const selectedJob = getJob('library-aide');
    const intro = getIntroContent(selectedJob);
    const stateAfterLandingStart = {
      ...initialState,
      selectedJobId: selectedJob.id,
      view: 'intro' as const
    };

    expect(stateAfterLandingStart.selectedJobId).toBe('library-aide');
    expect(intro.message).toBe('도서관 사서가 일하는 장면을 하나씩 볼게요.');
    expect(intro.nextView).toBe('day');
  });

  it('cycles to the next job inside the intro page', () => {
    expect(getNextIntroJobId('barista-aide')).toBe('library-aide');
    expect(getNextIntroJobId('library-aide')).toBe('baker-aide');
    expect(getNextIntroJobId('baker-aide')).toBe('barista-aide');
  });

  it('uses generated v2 Eiden scene images for every job step', () => {
    for (const job of jobs) {
      for (const scene of job.scenes) {
        const image = getSceneImage(job.id, scene.id);

        expect(image).toContain('/assets/generated/scenes/v2/');
        expect(image).toMatch(/-eiden-v2\.png$/);
      }
    }
  });

  it('keeps scene narration available separately from the student prompt', () => {
    const scene = getJob('barista-aide').scenes[0];

    expect(getSceneNarration(scene)).toContain('이든');
    expect(getSceneNarration(scene)).not.toBe(scene.prompt);
    expect(hasBannedCopy(getSceneNarration(scene))).toBe(false);
  });

  it('turns student support actions into teacher review logs without scores', () => {
    const job = getJob('baker-aide');
    const log = mockCoachGateway.createSupportLog('help', { ...initialState, selectedJobId: 'baker-aide' }, job);

    expect(log).not.toBeNull();
    expect(log?.status).toBe('확인 대기');
    expect(log?.signal).toBe('도움 필요');
    expect(hasBannedCopy(`${log?.summary} ${log?.supportLevel}`)).toBe(false);
  });
});
