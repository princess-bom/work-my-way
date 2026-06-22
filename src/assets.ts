import type { JobId } from './domain';

const generatedRoot = '/assets/generated';
const generatedSceneV2Root = `${generatedRoot}/scenes/v2`;

export const appAssets = {
  characters: {
    wave: `${generatedRoot}/characters/eiden-wave-shared-1200x1600-v1.png`,
    speaking: `${generatedRoot}/characters/eiden-speaking-shared-1200x1600-v1.png`,
    neutral: `${generatedRoot}/characters/eiden-neutral-shared-1200x1600-v1.png`,
    celebration: `${generatedRoot}/characters/eiden-celebration-shared-1200x1600-v1.png`,
    baristaWelcome: `${generatedRoot}/characters/eiden-barista-welcome-shared-1024x1536-v1.png`,
    librarianWelcome: `${generatedRoot}/characters/eiden-librarian-welcome-shared-1024x1536-v1.png`,
    bakerWelcome: `${generatedRoot}/characters/eiden-baker-welcome-shared-1024x1536-v1.png`
  },
  save: {
    notebook: `${generatedRoot}/save/save-notebook-tabletop-shared-1400x1000-v1.png`
  },
  records: {
    scrapbook: `${generatedRoot}/records/records-scrapbook-props-shared-1400x1000-v1.png`
  },
  support: {
    visualPanels: `${generatedRoot}/support/support-visual-panels-shared-1200x800-v1.png`
  },
  aac: {
    cup: `${generatedRoot}/aac/aac-cup-v1.png`,
    tool: `${generatedRoot}/aac/aac-tool-v1.png`,
    ready: `${generatedRoot}/aac/aac-ready-v1.png`
  },
  teacher: {
    teacherAvatar: `${generatedRoot}/teacher/teacher-avatar-shared-1024x1024-v1.png`,
    studentAvatars: `${generatedRoot}/teacher/student-avatar-set-shared-1024x1024-v1.png`
  }
} as const;

export const jobEidenWelcome: Record<JobId, string> = {
  'barista-aide': appAssets.characters.baristaWelcome,
  'library-aide': appAssets.characters.librarianWelcome,
  'baker-aide': appAssets.characters.bakerWelcome
};

export const jobVisuals: Record<JobId, {
  diorama: string;
  scenes: Record<string, string>;
}> = {
  'barista-aide': {
    diorama: `${generatedRoot}/jobs/job-barista-diorama-shared-1600x1200-v1.png`,
    scenes: {
      prep: `${generatedSceneV2Root}/scene-barista-01-prepare-eiden-v2.png`,
      guest: `${generatedSceneV2Root}/scene-barista-02-greet-eiden-v2.png`,
      drink: `${generatedSceneV2Root}/scene-barista-03-drink-eiden-v2.png`,
      clean: `${generatedSceneV2Root}/scene-barista-04-clean-eiden-v2.png`
    }
  },
  'library-aide': {
    diorama: `${generatedRoot}/jobs/job-librarian-diorama-shared-1600x1200-v1.png`,
    scenes: {
      return: `${generatedSceneV2Root}/scene-librarian-01-return-eiden-v2.png`,
      shelf: `${generatedSceneV2Root}/scene-librarian-02-shelf-eiden-v2.png`,
      guide: `${generatedSceneV2Root}/scene-librarian-03-guide-eiden-v2.png`,
      space: `${generatedSceneV2Root}/scene-librarian-04-space-eiden-v2.png`
    }
  },
  'baker-aide': {
    diorama: `${generatedRoot}/jobs/job-baker-diorama-shared-1600x1200-v1.png`,
    scenes: {
      tools: `${generatedSceneV2Root}/scene-baker-01-tools-wide-eiden-v2.png`,
      mix: `${generatedSceneV2Root}/scene-baker-02-mix-wide-eiden-v2.png`,
      bake: `${generatedSceneV2Root}/scene-baker-03-bake-wide-eiden-v2.png`,
      clean: `${generatedSceneV2Root}/scene-baker-04-clean-wide-eiden-v2.png`
    }
  }
};

export function getJobVisual(jobId: JobId) {
  return jobVisuals[jobId];
}

export function getSceneImage(jobId: JobId, sceneId: string) {
  const visuals = getJobVisual(jobId);
  return visuals.scenes[sceneId] ?? Object.values(visuals.scenes)[0];
}
