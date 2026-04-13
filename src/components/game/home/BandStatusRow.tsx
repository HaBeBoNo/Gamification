import { CalendarDays, ChevronRight, Trophy, Zap } from 'lucide-react';
import { MEMBERS } from '@/data/members';
import { useHomeBandStatusCards } from '@/hooks/useHomeSurface';
import { CARD_PAD_COMPACT, MOBILE_GUTTER, SECTION_GAP_COMPACT } from './constants';

const TOTAL_MEMBERS = Object.keys(MEMBERS).length;

const CARD_ICONS = {
  activity: Zap,
  calendar: CalendarDays,
  rank: Trophy,
} as const;

const CARD_TARGETS = {
  activity: 'activity',
  calendar: 'bandhub',
  rank: 'leaderboard',
} as const;

const CARD_ARIA = {
  activity: 'Öppna aktivitet',
  calendar: 'Öppna kalender',
  rank: 'Öppna ranking',
} as const;

type BandStatusRowProps = {
  onNavigate?: (tab: string) => void;
};

export function BandStatusRow({ onNavigate }: BandStatusRowProps) {
  const cards = useHomeBandStatusCards(TOTAL_MEMBERS);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: SECTION_GAP_COMPACT,
      padding: `0 ${MOBILE_GUTTER}`,
    }}>
      {cards.map((card) => {
        const Icon = CARD_ICONS[card.kind];
        const target = CARD_TARGETS[card.kind];
        return (
          <button
            key={card.kind}
            type="button"
            onClick={() => onNavigate?.(target)}
            style={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              padding: CARD_PAD_COMPACT,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              width: '100%',
              minWidth: 0,
              appearance: 'none',
              WebkitAppearance: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              touchAction: 'manipulation',
              transition: 'transform var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)',
            }}
            aria-label={CARD_ARIA[card.kind]}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: 2,
            }}>
              <div style={{
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-secondary)',
                flexShrink: 0,
              }}>
                <Icon size={16} strokeWidth={1.9} />
              </div>
              <div style={{
                width: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)',
                flexShrink: 0,
              }}>
                <ChevronRight size={14} strokeWidth={1.9} />
              </div>
            </div>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-subheading)',
              color: 'var(--color-text)',
              fontWeight: 700,
              lineHeight: 1,
            }}>
              {card.value}
            </span>
            <span style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {card.label}
            </span>
            <span style={{
              fontSize: 'var(--text-micro)',
              color: 'var(--color-text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {card.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
