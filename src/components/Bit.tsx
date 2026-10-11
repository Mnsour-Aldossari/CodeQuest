/** Bit the robot — SVG ported from the design; moods are driven by kit.css classes. */
export type Mood = 'idle' | 'wave' | 'thinking' | 'running' | 'happy' | 'sad' | 'celebrate';

export function Bit({ mood = 'idle', size = 92, className = '', shadow = true }: { mood?: Mood; size?: number; className?: string; shadow?: boolean }) {
  return (
    <svg className={`bit bit--${mood} ${className}`} viewBox="-12 -16 144 150" width={size} height={size * 1.04} aria-hidden="true" style={{ flex: 'none' }}>
      {shadow && <ellipse cx="60" cy="126" rx="28" ry="5" fill="#1F1A2E" opacity=".14" />}
      <g className="b-all">
        <g className="x-lines" fill="none" stroke="#1F1A2E" strokeWidth="3" strokeLinecap="round" opacity=".5">
          <path d="M-6 50 H8" />
          <path d="M-10 66 H4" />
          <path d="M-6 82 H8" />
        </g>
        <g className="b-body">
          <g className="b-arm-l">
            <rect x="16" y="84" width="14" height="28" rx="7" fill="#E4DEFF" stroke="#1F1A2E" strokeWidth="3" />
          </g>
          <g className="b-arm-r">
            <rect x="90" y="84" width="14" height="28" rx="7" fill="#E4DEFF" stroke="#1F1A2E" strokeWidth="3" />
          </g>
          <rect x="30" y="80" width="60" height="38" rx="15" fill="#E4DEFF" stroke="#1F1A2E" strokeWidth="3" />
          <circle className="b-core" cx="60" cy="99" r="6.5" fill="#FFB547" stroke="#1F1A2E" strokeWidth="2.5" />
          <g className="b-head">
            <line x1="60" y1="22" x2="60" y2="8" stroke="#1F1A2E" strokeWidth="3" strokeLinecap="round" />
            <circle className="b-ant" cx="60" cy="6" r="6" fill="#FF7A59" stroke="#1F1A2E" strokeWidth="2.5" />
            <rect x="14" y="20" width="92" height="64" rx="26" fill="#F7F5FF" stroke="#1F1A2E" strokeWidth="3" />
            <rect x="25" y="31" width="70" height="42" rx="17" fill="#1F1A2E" />
            <g className="cheeks" fill="#FF8FAB">
              <ellipse cx="22" cy="66" rx="5" ry="3.5" />
              <ellipse cx="98" cy="66" rx="5" ry="3.5" />
            </g>
            <g className="e-normal">
              <g className="b-eyes">
                <rect x="39" y="41" width="11" height="17" rx="5.5" fill="#5CF2E8" />
                <rect x="70" y="41" width="11" height="17" rx="5.5" fill="#5CF2E8" />
              </g>
            </g>
            <g className="e-happy" fill="none" stroke="#5CF2E8" strokeWidth="4.5" strokeLinecap="round">
              <path d="M38 53 Q44.5 43 51 53" />
              <path d="M69 53 Q75.5 43 82 53" />
            </g>
            <g className="e-sad">
              <rect x="39" y="47" width="11" height="10" rx="5" fill="#5CF2E8" />
              <rect x="70" y="47" width="11" height="10" rx="5" fill="#5CF2E8" />
              <path d="M37 44 L51 41 M83 44 L69 41" stroke="#5CF2E8" strokeWidth="3.5" strokeLinecap="round" />
            </g>
            <path className="m-flat" d="M54 64 H66" stroke="#5CF2E8" strokeWidth="3.5" strokeLinecap="round" />
            <path className="m-smile" d="M51 62 Q60 70 69 62" fill="none" stroke="#5CF2E8" strokeWidth="3.5" strokeLinecap="round" />
            <path className="m-sad" d="M52 67 Q60 61 68 67" fill="none" stroke="#5CF2E8" strokeWidth="3.5" strokeLinecap="round" />
            <ellipse className="m-o" cx="60" cy="65" rx="4" ry="4.5" fill="#5CF2E8" />
          </g>
        </g>
      </g>
      <g className="x-dots" fill="#6A3FD6">
        <circle cx="98" cy="10" r="4" />
        <circle cx="110" cy="2" r="4.5" />
        <circle cx="122" cy="-8" r="5" />
      </g>
      <text className="x-q" x="104" y="16" fontFamily="Baloo Bhaijaan 2, sans-serif" fontWeight="800" fontSize="30" fill="#D23B3B">
        ?
      </text>
      <g className="x-stars" fill="#FFC53D" stroke="#C98A0C" strokeWidth="1.5">
        <path d="M4 8 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" />
        <path d="M108 -4 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" />
        <path d="M116 52 l2 5 5 1 -4 3 1 5 -4 -2 -4 2 1 -5 -4 -3 5 -1z" />
      </g>
    </svg>
  );
}
