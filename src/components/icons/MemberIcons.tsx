import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

const svgBase = (size: number, color: string, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
});

/** Creative Director — spark/signal burst */
export function HannesIcon({ size = 24, color = '#e07840', className }: IconProps) {
  return (
    <svg {...svgBase(size, color, className)}>
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Ordförande — minimal geometric crown, 3 points */
export function LudvigIcon({ size = 24, color = '#40c060', className }: IconProps) {
  return (
    <svg {...svgBase(size, color, className)}>
      <polyline points="3,18 3,10 7,14 12,6 17,14 21,10 21,18" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

/** Head of Production — waveform, 5 bars */
export function MartinIcon({ size = 24, color = '#4090e0', className }: IconProps) {
  return (
    <svg {...svgBase(size, color, className)}>
      <line x1="4" y1="10" x2="4" y2="14" />
      <line x1="8" y1="7" x2="8" y2="17" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="16" y1="8" x2="16" y2="16" />
      <line x1="20" y1="10" x2="20" y2="14" />
    </svg>
  );
}

/** PR & Outreach — radar/signal arcs */
export function NisseIcon({ size = 24, color = '#a050e0', className }: IconProps) {
  return (
    <svg {...svgBase(size, color, className)}>
      <circle cx="12" cy="18" r="2" />
      <path d="M8.5 14.5a5 5 0 0 1 7 0" />
      <path d="M5.5 11.5a9 9 0 0 1 13 0" />
      <path d="M2.5 8.5a13 13 0 0 1 19 0" />
    </svg>
  );
}

/** Business Manager — briefcase */
export function SimonIcon({ size = 24, color = '#e06050', className }: IconProps) {
  return (
    <svg {...svgBase(size, color, className)}>
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <path d="M8 9V7a4 4 0 0 1 8 0v2" />
      <line x1="12" y1="13" x2="12" y2="15" />
    </svg>
  );
}

/** Logistics & Merch — compass/arrow forward */
export function JohannesIcon({ size = 24, color = '#40a0e0', className }: IconProps) {
  return (
    <svg {...svgBase(size, color, className)}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="12,7 15,14 12,12.5 9,14" stroke={color} fill="none" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
    </svg>
  );
}

/** Grant Manager — open book/document with fold */
export function CarlIcon({ size = 24, color = '#c8a040', className }: IconProps) {
  return (
    <svg {...svgBase(size, color, className)}>
      <path d="M4 4h12l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4z" />
      <polyline points="16,4 16,8 20,8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="13" y2="16" />
    </svg>
  );
}

/** Tech & Facilities — circuit node */
export function NiklasIcon({ size = 24, color = '#40c080', className }: IconProps) {
  return (
    <svg {...svgBase(size, color, className)}>
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="3" x2="12" y2="9" />
      <line x1="12" y1="15" x2="12" y2="21" />
      <line x1="3" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="21" y2="12" />
      <circle cx="12" cy="3" r="1.5" />
      <circle cx="12" cy="21" r="1.5" />
      <circle cx="3" cy="12" r="1.5" />
      <circle cx="21" cy="12" r="1.5" />
    </svg>
  );
}

/** Map member ID → icon component */
export const MEMBER_ICONS: Record<string, React.FC<IconProps>> = {
  hannes: HannesIcon,
  ludvig: LudvigIcon,
  martin: MartinIcon,
  nisse: NisseIcon,
  simon: SimonIcon,
  johannes: JohannesIcon,
  carl: CarlIcon,
  niklas: NiklasIcon,
};

/** Helper: render member icon by ID */
export function MemberIcon({ id, size = 24, color, className }: IconProps & { id: string }) {
  const Icon = MEMBER_ICONS[id];
  if (!Icon) return null;
  return <Icon size={size} color={color} className={className} />;
}
