import type { JobId } from './domain';

export type JobTheme = {
  bg: string;
  ghost: string;
  accent: string;
  text: string;
  trackNum: string;
  bgTitle: string;
  glow: string;
};

export const GRAIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
    </filter>
    <rect width="100%" height="100%" filter="url(#n)" opacity="0.08" />
  </svg>`
);

export const jobThemes: Record<JobId, JobTheme> = {
  'barista-aide': {
    bg: '#F2E4D6',
    ghost: 'rgba(92, 58, 28, 0.08)',
    accent: '#fc7204',
    text: '#5C3A1C',
    trackNum: 'TRACK 01 · CAFE BARISTA',
    bgTitle: '나의 첫 카페',
    glow: 'rgba(252, 114, 4, 0.22)'
  },
  'library-aide': {
    bg: '#D8E5F2',
    ghost: 'rgba(28, 52, 88, 0.09)',
    accent: '#2f6fd4',
    text: '#1C3458',
    trackNum: 'TRACK 02 · BOOK LIBRARIAN',
    bgTitle: '나의 첫 도서관',
    glow: 'rgba(47, 111, 212, 0.2)'
  },
  'baker-aide': {
    bg: '#EDE3F4',
    ghost: 'rgba(68, 42, 98, 0.08)',
    accent: '#7b52b8',
    text: '#442A62',
    trackNum: 'TRACK 03 · SWEET BAKER',
    bgTitle: '나의 첫 베이커리',
    glow: 'rgba(123, 82, 184, 0.22)'
  }
};

export function getJobTheme(jobId: JobId) {
  return jobThemes[jobId];
}
