import { ArrowLeft, ArrowRight, GraduationCap, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { appAssets, getJobVisual } from './assets';
import { jobs } from './data';
import type { JobId } from './domain';
import { GRAIN_SVG, jobThemes } from './theme';

const TRANSITION = '650ms cubic-bezier(0.4, 0, 0.2, 1)';
const ITEM_TRANSITION = `transform ${TRANSITION}, filter ${TRANSITION}, opacity ${TRANSITION}, left ${TRANSITION}, height ${TRANSITION}, bottom ${TRANSITION}`;

interface CarouselItem {
  id: string;
  title: string;
  src: string;
  bg: string;
  ghost: string;
  accent: string;
  description: string;
  isDiorama: boolean;
  textColor: string;
  trackNum: string;
  bgTitle: string;
  onSelect?: () => void;
}

type CarouselRole = 'center' | 'left' | 'right';

function getRole(index: number, activeIndex: number): CarouselRole {
  if (index === activeIndex) return 'center';
  if (index === (activeIndex + 2) % 3) return 'left';
  return 'right';
}

function getRoleStyle(role: CarouselRole, isMobile: boolean): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    aspectRatio: '4 / 3',
    transition: ITEM_TRANSITION,
    willChange: 'transform, filter, opacity'
  };

  switch (role) {
    case 'center':
      return {
        ...base,
        left: '50%',
        bottom: isMobile ? '28%' : 0,
        height: isMobile ? '44%' : '66%',
        transform: 'translateX(-50%) scale(1.0)',
        filter: 'blur(0px)',
        opacity: 1,
        zIndex: 20
      };
    case 'left':
      return {
        ...base,
        left: isMobile ? '12%' : '30%',
        bottom: isMobile ? '38%' : '12%',
        height: isMobile ? '18%' : '24%',
        transform: 'translateX(-50%) scale(0.85)',
        filter: 'blur(2px)',
        opacity: isMobile ? 0.5 : 0.85,
        zIndex: 10
      };
    case 'right':
      return {
        ...base,
        left: isMobile ? '88%' : '70%',
        bottom: isMobile ? '38%' : '12%',
        height: isMobile ? '18%' : '24%',
        transform: 'translateX(-50%) scale(0.85)',
        filter: 'blur(2px)',
        opacity: isMobile ? 0.5 : 0.85,
        zIndex: 10
      };
  }
}

type LandingHeroProps = {
  initialJobId?: JobId;
  onStart: (jobId: JobId) => void;
  onTeacher: () => void;
};

export function LandingHero({ initialJobId = 'barista-aide', onStart, onTeacher }: LandingHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  const CAROUSEL_ITEMS: CarouselItem[] = useMemo(() => [
    {
      id: 'barista-aide',
      title: '바리스타',
      src: getJobVisual('barista-aide').diorama,
      bg: jobThemes['barista-aide'].bg,
      ghost: jobThemes['barista-aide'].ghost,
      accent: jobThemes['barista-aide'].accent,
      description: '원두를 고르고, 에스프레소를 내리고, 라떼 아트를 그려요. 바리스타의 하루를 직접 체험해 보세요.',
      isDiorama: true,
      textColor: jobThemes['barista-aide'].text,
      trackNum: jobThemes['barista-aide'].trackNum,
      bgTitle: jobThemes['barista-aide'].bgTitle
    },
    {
      id: 'library-aide',
      title: '도서관 사서',
      src: getJobVisual('library-aide').diorama,
      bg: jobThemes['library-aide'].bg,
      ghost: jobThemes['library-aide'].ghost,
      accent: jobThemes['library-aide'].accent,
      description: '책을 분류하고, 추천 목록을 만들고, 독서 행사를 기획해요. 사서의 하루를 직접 체험해 보세요.',
      isDiorama: true,
      textColor: jobThemes['library-aide'].text,
      trackNum: jobThemes['library-aide'].trackNum,
      bgTitle: jobThemes['library-aide'].bgTitle
    },
    {
      id: 'baker-aide',
      title: '제빵사',
      src: getJobVisual('baker-aide').diorama,
      bg: jobThemes['baker-aide'].bg,
      ghost: jobThemes['baker-aide'].ghost,
      accent: jobThemes['baker-aide'].accent,
      description: '반죽을 만들고, 발효를 기다리고, 갓 구운 빵 향기를 맡아요. 제빵사의 하루를 직접 체험해 보세요.',
      isDiorama: true,
      textColor: jobThemes['baker-aide'].text,
      trackNum: jobThemes['baker-aide'].trackNum,
      bgTitle: jobThemes['baker-aide'].bgTitle
    }
  ], []);

  // initialJobId가 있으면 처음에 해당 인덱스로 매핑
  useEffect(() => {
    const idx = CAROUSEL_ITEMS.findIndex((item) => item.id === initialJobId);
    if (idx !== -1) {
      setActiveIndex(idx);
    }
  }, [initialJobId, CAROUSEL_ITEMS]);

  useEffect(() => {
    CAROUSEL_ITEMS.forEach(({ src }) => {
      const img = new Image();
      img.src = src;
    });
  }, [CAROUSEL_ITEMS]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const navigate = useCallback(
    (direction: 'next' | 'prev') => {
      if (isAnimating) return;
      setIsAnimating(true);
      setActiveIndex((prev) => (direction === 'next' ? (prev + 1) % 3 : (prev + 2) % 3));
      window.setTimeout(() => setIsAnimating(false), 650);
    },
    [isAnimating]
  );

  const activeItem = CAROUSEL_ITEMS[activeIndex];

  const handleStartExploration = () => {
    onStart(activeItem.id as JobId);
  };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: activeItem.bg,
        transition: `background-color ${TRANSITION}`,
        fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif"
      }}
    >
      <div className="relative w-full" style={{ height: '100dvh', minHeight: '100vh', overflow: 'hidden' }}>
        {/* Grain overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 50,
            opacity: 0.4,
            backgroundImage: `url("data:image/svg+xml,${GRAIN_SVG}")`,
            backgroundSize: '200px 200px',
            backgroundRepeat: 'repeat'
          }}
          aria-hidden
        />

        {/* Giant ghost text — behind diorama for depth */}
        <div
          className="pointer-events-none absolute inset-x-0 flex select-none items-center justify-center"
          style={{ zIndex: 2, top: isMobile ? '4%' : 0, bottom: isMobile ? '50%' : '35%' }}
          aria-hidden
        >
          {CAROUSEL_ITEMS.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <span
                key={item.id}
                style={{
                  position: 'absolute',
                  fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif",
                  fontSize: isMobile ? 'clamp(36px, 11vw, 64px)' : 'clamp(120px, 14vw, 320px)',
                  fontWeight: 900,
                  color: item.textColor,
                  opacity: isActive ? (isMobile ? 0.1 : 0.18) : 0,
                  transform: isActive ? 'scale(1)' : 'scale(0.96)',
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  whiteSpace: 'nowrap',
                  transition: `opacity ${TRANSITION}, transform ${TRANSITION}, color ${TRANSITION}`,
                  pointerEvents: 'none'
                }}
              >
                {item.bgTitle}
              </span>
            );
          })}
        </div>

        {/* Brand label */}
        <div
          className="absolute top-6 left-4 sm:left-8 flex items-center gap-3"
          style={{ zIndex: 60, transition: `color ${TRANSITION}` }}
        >
          <Sparkles
            size={22}
            strokeWidth={2.5}
            className="animate-float-gentle"
            style={{
              color: activeItem.accent,
              transition: `color ${TRANSITION}`
            }}
          />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
            <span
              style={{
                fontSize: '22px',
                fontWeight: 900,
                color: activeItem.textColor,
                letterSpacing: '-0.03em',
                transition: `color ${TRANSITION}`
              }}
            >
              꿈이든
            </span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: activeItem.textColor,
                opacity: 0.5,
                letterSpacing: '-0.01em',
                transition: `color ${TRANSITION}`
              }}
            >
              내일탐색
            </span>
          </div>
        </div>

        {/* 교사용으로 보기 */}
        <button
          type="button"
          onClick={onTeacher}
          className="absolute top-5 right-4 z-[60] flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold rounded-full cursor-pointer"
          style={{
            color: activeItem.textColor,
            backgroundColor: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.4)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            transition: `all 200ms, color ${TRANSITION}`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.85)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.65)';
            e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
          }}
        >
          <GraduationCap size={16} strokeWidth={2.4} aria-hidden="true" />
          교사용으로 보기
        </button>

        {/* Carousel */}
        <div className="absolute inset-0" style={{ zIndex: 3 }}>
          {CAROUSEL_ITEMS.map((item, index) => {
            const role = getRole(index, activeIndex);
            return (
              <div key={item.id} style={getRoleStyle(role, isMobile)}>
                <img
                  src={item.src}
                  alt={`${item.title} 캐릭터/디오라마`}
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    objectPosition: 'bottom center',
                    filter: role === 'center' ? 'drop-shadow(0 20px 40px rgba(0,0,0,0.12))' : 'drop-shadow(0 8px 16px rgba(0,0,0,0.06))'
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Bottom controls — stacked vertically on mobile for space */}
        <div
          style={{
            position: 'absolute',
            zIndex: 60,
            ...(isMobile ? {
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              padding: '20px 16px calc(16px + env(safe-area-inset-bottom, 0px))',
              background: `linear-gradient(to top, ${activeItem.bg} 60%, transparent)`,
              transition: `background ${TRANSITION}`
            } : {
              left: 'clamp(48px, 6vw, 120px)',
              bottom: 'clamp(48px, 8vh, 120px)',
              maxWidth: 460,
              padding: 0,
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              transition: `all ${TRANSITION}`
            })
          }}
        >
          <p
            style={{
              margin: '0 0 6px',
              color: activeItem.textColor,
              opacity: 0.8,
              fontSize: isMobile ? '10px' : '12px',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              transition: `color ${TRANSITION}`
            }}
          >
            {activeItem.trackNum}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: isMobile ? '8px' : '14px' }}>
            <div
              style={{
                width: '3.5px',
                height: isMobile ? '24px' : '32px',
                borderRadius: '4px',
                backgroundColor: activeItem.accent,
                transition: `background-color ${TRANSITION}`
              }}
            />
            <h3
              style={{
                margin: 0,
                color: activeItem.textColor,
                fontSize: isMobile ? '18px' : 'clamp(28px, 2.4vw, 36px)',
                fontWeight: 900,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                transition: `color ${TRANSITION}`
              }}
            >
              {activeItem.title}
            </h3>
          </div>
          {!isMobile && (
            <p
              style={{
                margin: '0 0 18px',
                color: activeItem.textColor,
                opacity: 0.88,
                fontSize: 'clamp(14px, 1.1vw, 17px)',
                lineHeight: 1.7,
                fontWeight: 480,
                wordBreak: 'keep-all' as const,
                textShadow: `0 0 12px ${activeItem.bg}, 0 0 8px ${activeItem.bg}, 0 0 4px ${activeItem.bg}`,
                transition: `color ${TRANSITION}`
              }}
            >
              {activeItem.description}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: isMobile ? '12px' : 0 }}>
            <button
              type="button"
              aria-label="Previous job"
              onClick={() => navigate('prev')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? '44px' : '52px',
                height: isMobile ? '44px' : '52px',
                borderRadius: '50%',
                border: `2px solid ${activeItem.textColor}`,
                backgroundColor: 'transparent',
                color: activeItem.textColor,
                cursor: 'pointer',
                transition: 'transform 150ms, background-color 150ms'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${activeItem.textColor}12`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ArrowLeft size={isMobile ? 20 : 24} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              aria-label="Next job"
              onClick={() => navigate('next')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? '44px' : '52px',
                height: isMobile ? '44px' : '52px',
                borderRadius: '50%',
                border: `2px solid ${activeItem.textColor}`,
                backgroundColor: 'transparent',
                color: activeItem.textColor,
                cursor: 'pointer',
                transition: 'transform 150ms, background-color 150ms'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${activeItem.textColor}12`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ArrowRight size={isMobile ? 20 : 24} strokeWidth={2.25} />
            </button>
            {/* CTA button inline (always, but desktop is sized differently) */}
            {isMobile ? (
              <button
                type="button"
                onClick={handleStartExploration}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif",
                  backgroundColor: activeItem.accent,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '60px',
                  padding: '14px 24px',
                  fontSize: '15px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  boxShadow: `0 8px 28px ${activeItem.accent}50`,
                  transition: `all 250ms, background-color ${TRANSITION}, box-shadow ${TRANSITION}`
                }}
              >
                체험 시작하기
                <ArrowRight size={18} strokeWidth={2.5} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartExploration}
                style={{
                  marginLeft: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif",
                  backgroundColor: activeItem.accent,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '60px',
                  padding: '16px 36px',
                  fontSize: '17px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  boxShadow: `0 8px 28px ${activeItem.accent}35`,
                  transition: `all 250ms, background-color ${TRANSITION}, box-shadow ${TRANSITION}`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `0 12px 36px ${activeItem.accent}55`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = `0 8px 28px ${activeItem.accent}35`;
                }}
              >
                체험 시작하기
                <ArrowRight size={19} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
