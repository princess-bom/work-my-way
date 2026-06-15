import { describe, expect, it } from 'vitest';
import { createRecord, mockCoachGateway } from './adapters';
import { getIntroContent, getNextIntroJobId, hasBannedCopy } from './App';
import { getSceneImage } from './assets';
import { createCoachReply, getJob, getSceneAacOptions, getSceneNarration, getSceneObservationPrompt, initialState, jobs } from './data';

describe('student exploration copy and records', () => {
  it('flags teacher-dashboard ranking or scoring copy as banned', () => {
    expect(hasBannedCopy('학생 점수와 적합률을 보여줍니다')).toBe(true);
    expect(hasBannedCopy('정답을 잘했어요')).toBe(true);
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
    expect(getSceneNarration(scene)).not.toContain('?');
    expect(getSceneNarration(scene)).not.toContain('무엇일까요');
    expect(hasBannedCopy(getSceneNarration(scene))).toBe(false);
  });

  it('offers AAC choices as participation rather than scoring answers', () => {
    const scene = getJob('barista-aide').scenes[0];
    const options = getSceneAacOptions(scene);

    expect(getSceneObservationPrompt(scene)).toContain('버튼');
    expect(options.map((option) => option.label)).toEqual(expect.arrayContaining(['컵', '도구', '잘 모르겠어요', '다시 듣기', '선생님 도움']));
    expect(options.every((option) => !hasBannedCopy(`${option.label} ${option.value}`))).toBe(true);
  });

  it('creates respectful Eiden follow-up copy from AAC participation', () => {
    const scene = getJob('library-aide').scenes[1];
    const option = getSceneAacOptions(scene).find((item) => item.id === 'bookshelf');

    expect(option).toBeDefined();
    const reply = createCoachReply(scene, option!);

    expect(reply).toContain('함께');
    expect(reply).toContain('습니다');
    expect(reply).not.toContain('정답');
    expect(reply).not.toContain('틀렸');
    expect(hasBannedCopy(reply)).toBe(false);
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
