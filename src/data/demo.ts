import type { SupportRequest } from '../../shared/support-schema';

export const libraryScene: SupportRequest['scene'] = {
  jobTitle: '도서관 사서',
  sceneTitle: '반납된 책 정리하기',
  description: '도서관 책상 위에 반납된 책이 있습니다.',
  question: '반납된 책은 어디에 먼저 놓을까요?'
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
