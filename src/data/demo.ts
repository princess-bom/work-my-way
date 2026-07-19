import type { SupportRequest } from '../../shared/support-schema';

export const libraryScene: SupportRequest['scene'] = {
  jobTitle: 'Library Assistant',
  sceneTitle: 'Returning a book',
  description: 'A visitor has returned a book at the library desk.',
  question: 'Where should a returned book go first?'
};

export const explorationSteps = [
  { label: 'Welcome', state: 'done' },
  { label: 'Meet the job', state: 'done' },
  { label: 'Try a scene', state: 'active' },
  { label: 'Reflect', state: 'next' }
] as const;

export const syntheticLearners = [
  { initials: 'AM', name: 'Alex M.', scene: 'Library Assistant', time: 'Just now', active: true },
  { initials: 'JR', name: 'Jamie R.', scene: 'Café Assistant', time: '8 min ago', active: false },
  { initials: 'TS', name: 'Taylor S.', scene: 'Bakery Assistant', time: '18 min ago', active: false }
] as const;
