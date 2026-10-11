/** Stroke icons from the design (inline SVG, decorative unless labelled by the parent). */
import type { CSSProperties } from 'react';

const P: Record<string, string> = {
  chevron: 'm9 6 6 6-6 6',
  chevronBack: 'm15 6-6 6 6 6',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  album: 'M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM9 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M21 16l-5-5-8 8',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11M9 8h6',
  grid: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM17 13v8M13 17h8',
  soundOn: 'M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  soundOff: 'M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6',
  reset: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  terminal: 'M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM7 10l3 2-3 2M12 15h5',
  robot: 'M5 12a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM12 8V4M9 13h.01M15 13h.01',
  code: 'm8 7-5 5 5 5M16 7l5 5-5 5',
  lock: 'M5 13a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM8 11V8a4 4 0 0 1 8 0v3',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12 5 5 9-10',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  blocks: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  build: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
  stats: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  house: 'M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5',
  tree: 'M12 3 5 14h14zM12 8 7 17h10zM12 17v4',
  gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 22, stroke = 2.2, style, className }: { name: IconName; size?: number; stroke?: number; style?: CSSProperties; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style} className={className}>
      <path d={P[name]} />
    </svg>
  );
}

export function PlayIcon({ size = 22, flip = false }: { size?: number; flip?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <path d="M7 5.5v13a1 1 0 0 0 1.5.9L19 13a1.2 1.2 0 0 0 0-2L8.5 4.6A1 1 0 0 0 7 5.5z" />
    </svg>
  );
}

export function StepIcon({ size = 20, flip = false }: { size?: number; flip?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <path d="M5 5.5v13a1 1 0 0 0 1.5.9L15 13.2a1.4 1.4 0 0 0 0-2.4L6.5 4.6A1 1 0 0 0 5 5.5z" />
      <rect x="16.5" y="5" width="3" height="14" rx="1.2" />
    </svg>
  );
}

export function Star({ on, size = 28, className = '', style }: { on: boolean; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg className={`star ${on ? 'on' : ''} ${className}`} viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, ...style }}>
      <path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z" />
    </svg>
  );
}
