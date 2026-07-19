export type JobId = 'barista-aide' | 'library-aide' | 'baker-aide';

export type JobCard = {
  id: JobId;
  title: string;
  backgroundTitle: string;
  track: string;
  description: string;
  introduction: string;
  diorama: string;
  theme: {
    background: string;
    text: string;
    accent: string;
    glow: string;
  };
  demoReady: boolean;
};

export const JOBS: readonly JobCard[] = [
  {
    id: 'barista-aide',
    title: '바리스타',
    backgroundTitle: '나의 첫 카페',
    track: 'TRACK 01 · CAFE BARISTA',
    description: '컵과 도구를 준비하고, 손님을 맞이하며, 카페를 정리하는 일을 살펴봐요.',
    introduction: '바리스타는 필요한 도구를 준비하고 손님의 주문을 확인한 뒤 음료를 만들어요.',
    diorama: '/assets/cafe-diorama.avif',
    theme: {
      background: '#f2e4d6',
      text: '#5c3a1c',
      accent: '#ef7019',
      glow: 'rgba(239, 112, 25, 0.2)'
    },
    demoReady: false
  },
  {
    id: 'library-aide',
    title: '도서관 사서',
    backgroundTitle: '나의 첫 도서관',
    track: 'TRACK 02 · BOOK LIBRARIAN',
    description: '반납된 책을 확인하고, 번호에 맞게 정리하며, 이용자가 책을 찾도록 도와요.',
    introduction: '도서관 사서는 반납된 책의 라벨을 확인하고, 같은 표시가 있는 곳에 책을 정리해요.',
    diorama: '/assets/library-diorama.avif',
    theme: {
      background: '#d8e5f2',
      text: '#1c3458',
      accent: '#2f6fd4',
      glow: 'rgba(47, 111, 212, 0.2)'
    },
    demoReady: true
  },
  {
    id: 'baker-aide',
    title: '제빵사',
    backgroundTitle: '나의 첫 베이커리',
    track: 'TRACK 03 · SWEET BAKER',
    description: '도구와 재료를 준비하고, 반죽을 만들며, 작업대를 정리하는 일을 살펴봐요.',
    introduction: '제빵사는 필요한 재료와 도구를 확인하고 순서에 맞게 빵을 만들어요.',
    diorama: '/assets/bakery-diorama.avif',
    theme: {
      background: '#ede3f4',
      text: '#442a62',
      accent: '#7b52b8',
      glow: 'rgba(123, 82, 184, 0.2)'
    },
    demoReady: false
  }
] as const;

export function getJob(jobId: JobId): JobCard {
  return JOBS.find((job) => job.id === jobId) ?? JOBS[1];
}
