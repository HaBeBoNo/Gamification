import { CalendarDays, Trophy, Zap } from 'lucide-react';
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
              borderRadius: 'var(--radius-card)',
              padding: CARD_PAD_COMPACT,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              width: '100%',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
            aria-label={CARD_ARIA[card.kind]}
          >
            <div style={{
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
              marginBottom: 2,
            }}>
              <Icon size={16} strokeWidth={1.9} />
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
            }}>
              {card.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
