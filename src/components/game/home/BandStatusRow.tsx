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

export function BandStatusRow() {
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
        return (
          <div key={card.kind} style={{
            background: 'var(--color-surface-elevated)',
            borderRadius: 'var(--radius-card)',
            padding: CARD_PAD_COMPACT,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
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
          </div>
        );
      })}
    </div>
  );
}
