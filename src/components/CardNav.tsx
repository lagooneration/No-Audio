import React, { useLayoutEffect, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
// use your own icon import if react-icons is not available
import { GoArrowUpRight } from 'react-icons/go';
import './CardNav.css';

type CardNavLink = {
  label: string;
  value?: string;
  href?: string;
  ariaLabel: string;
};

export type CardNavItem = {
  label: string;
  bgColor: string;
  textColor: string;
  links: CardNavLink[];
};

export interface CardNavProps {
  logo: string;
  logoAlt?: string;
  items: CardNavItem[];
  className?: string;
  ease?: string;
  baseColor?: string;
  menuColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  // Audio props
  isPlaying?: boolean;
  isLoading?: boolean;
  currentTime?: number;
  duration?: number;
  playbackRate?: number;
  audioFile?: {
    name: string;
    duration: number;
    channels: number;
    sampleRate: number;
  } | null;
  onTogglePlayPause?: () => void;
  onSeek?: (time: number) => void;
  onPlaybackRateChange?: (rate: number) => void;
  disabled?: boolean;
}

const CardNav: React.FC<CardNavProps> = ({
  logo,
  logoAlt = 'Logo',
  items,
  className = '',
  ease = 'power3.out',
  baseColor = '#fff',
  menuColor,
  buttonBgColor,
  buttonTextColor,
  // Audio props
  isPlaying = false,
  isLoading = false,
  currentTime = 0,
  duration = 0,
  playbackRate = 1,
  audioFile = null,
  onTogglePlayPause,
  onSeek,
  onPlaybackRateChange,
  disabled = false
}) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      const contentEl = navEl.querySelector('.card-nav-content') as HTMLElement;
      if (contentEl) {
        const wasVisible = contentEl.style.visibility;
        const wasPointerEvents = contentEl.style.pointerEvents;
        const wasPosition = contentEl.style.position;
        const wasHeight = contentEl.style.height;

        contentEl.style.visibility = 'visible';
        contentEl.style.pointerEvents = 'auto';
        contentEl.style.position = 'static';
        contentEl.style.height = 'auto';

        // Force layout calculation
        const _ = contentEl.offsetHeight;

        const topBar = 60;
        const padding = 16;
        const contentHeight = contentEl.scrollHeight;

        contentEl.style.visibility = wasVisible;
        contentEl.style.pointerEvents = wasPointerEvents;
        contentEl.style.position = wasPosition;
        contentEl.style.height = wasHeight;

        return topBar + contentHeight + padding;
      }
    }
    return 260;
  };

  const createTimeline = useCallback(() => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 60, overflow: 'hidden' });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease
    });

    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 }, '-=0.1');

    return tl;
  }, [ease]);

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
  }, [createTimeline, items]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;

      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });

        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();
        const newTl = createTimeline();
        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isExpanded, createTimeline]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;
    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const setCardRef = (i: number) => (el: HTMLDivElement | null) => {
    if (el) cardsRef.current[i] = el;
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`card-nav-container ${className}`}>
      <nav ref={navRef} className={`card-nav ${isExpanded ? 'open' : ''}`} style={{ backgroundColor: baseColor }}>
        <div className="card-nav-top">
          {/* Circular Play Button */}
          <button
            type="button"
            className={`card-nav-play-button ${disabled ? 'disabled' : ''}`}
            style={{ 
              backgroundColor: disabled ? '#666' : buttonBgColor, 
              color: disabled ? '#999' : buttonTextColor,
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: disabled ? 'not-allowed' : 'pointer'
            }}
            onClick={disabled ? undefined : onTogglePlayPause}
            disabled={disabled}
          >
            {isLoading ? (
              <div className="loading-spinner" style={{
                width: '20px',
                height: '20px',
                border: '2px solid transparent',
                borderTop: '2px solid currentColor',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="8,5 19,12 8,19" />
              </svg>
            )}
          </button>

          {/* Timeline and Audio Info */}
          <div className="card-nav-audio-info" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '4px',
            minWidth: '120px'
          }}>
            {audioFile ? (
              <>
                <div className="time-display" style={{ 
                  fontSize: '14px', 
                  fontWeight: '500',
                  color: disabled ? '#999' : '#333'
                }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
                <input
                  type="range"
                  className="timeline-slider"
                  min="0"
                  max={duration}
                  value={currentTime}
                  onChange={(e) => !disabled && onSeek?.(parseFloat(e.target.value))}
                  disabled={disabled}
                  style={{
                    width: '100%',
                    height: '4px',
                    background: disabled ? '#ccc' : '#ddd',
                    outline: 'none',
                    borderRadius: '2px',
                    cursor: disabled ? 'not-allowed' : 'pointer'
                  }}
                />
                <div style={{ 
                  fontSize: '12px', 
                  color: disabled ? '#999' : '#666',
                  textAlign: 'center'
                }}>
                  {audioFile.name}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '14px', color: '#999' }}>
                No audio loaded
              </div>
            )}
          </div>

          {/* Hamburger Menu */}
          <div
            className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''}`}
            onClick={toggleMenu}
            role="button"
            aria-label={isExpanded ? 'Close menu' : 'Open menu'}
            tabIndex={0}
            style={{ color: menuColor || '#000' }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {(items || []).slice(0, 3).map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="nav-card"
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className="nav-card-label">{item.label}</div>
              <div className="nav-card-links">
                {item.links?.map((lnk, i) => (
                  <div key={`${lnk.label}-${i}`} className="nav-card-link">
                    {lnk.href ? (
                      <a href={lnk.href} aria-label={lnk.ariaLabel}>
                        <GoArrowUpRight className="nav-card-link-icon" aria-hidden="true" />
                        {lnk.label}
                      </a>
                    ) : (
                      <div className="nav-card-analysis-item">
                        <span className="analysis-label">{lnk.label}:</span>
                        <span className="analysis-value">{lnk.value || 'N/A'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default CardNav;
