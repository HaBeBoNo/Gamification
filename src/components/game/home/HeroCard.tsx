import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { S, useGameStore } from '@/state/store';
import { CARD_PAD, CARD_PAD_ROOM, ROOM_GUTTER, SECTION_GAP } from './constants';

export function HeroCard() {
  // Prenumerera på tick så att XP/level-ändringar via save() triggar re-render
  useGameStore((s) => s.tick);
  const isCompact = useMediaQuery('(max-width: 420px)');
  const memberKey = S.me!;
  const member = (MEMBERS as Record<string, any>)[memberKey];
  const char = (S.chars as Record<string, any>)?.[memberKey];
  const avatarSize = isCompact ? 72 : 96;
  const avatarInset = isCompact ? 6 : 8;
  const radius = isCompact ? 33 : 44;
  const center = avatarSize / 2;

  if (!char) {
    return (
      <div style={{
        background: 'linear-gradient(160deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%)',
        borderBottom: '1px solid var(--color-border)',
        padding: `${isCompact ? CARD_PAD : CARD_PAD_ROOM} ${ROOM_GUTTER} ${CARD_PAD}`,
        display: 'flex',
        flexDirection: isCompact ? 'column' : 'row',
        alignItems: isCompact ? 'stretch' : 'center',
        gap: isCompact ? 'var(--space-md)' : SECTION_GAP,
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        <div style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '50%',
          background: 'var(--color-border)',
          flexShrink: 0,
          alignSelf: isCompact ? 'center' : 'flex-start',
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ height: 20, borderRadius: 4, background: 'var(--color-border)', marginBottom: 'var(--space-sm)', width: '60%' }} />
          <div style={{ height: 16, borderRadius: 4, background: 'var(--color-border)', marginBottom: 'var(--space-sm)', width: '40%' }} />
          <div style={{ height: 3, borderRadius: 2, background: 'var(--color-border)', marginBottom: 'var(--space-sm)' }} />
          <div style={{ height: 12, borderRadius: 3, background: 'var(--color-border)', width: '50%' }} />
        </div>
      </div>
    );
  }

  const xp = char?.xp ?? 0;
  const xpToNext = char?.xpToNext ?? 100;
  const level = char?.level ?? 1;
  const pct = Math.min(100, Math.round((xp / xpToNext) * 100));
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div style={{
      background: 'linear-gradient(160deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%)',
      borderBottom: '1px solid var(--color-border)',
      padding: `${isCompact ? CARD_PAD : CARD_PAD_ROOM} ${ROOM_GUTTER} ${CARD_PAD}`,
      display: 'flex',
      flexDirection: isCompact ? 'column' : 'row',
      alignItems: isCompact ? 'stretch' : 'center',
      gap: isCompact ? 'var(--space-md)' : SECTION_GAP,
    }}>
      <div style={{
        position: 'relative',
        width: avatarSize,
        height: avatarSize,
        flexShrink: 0,
        alignSelf: isCompact ? 'center' : 'flex-start',
      }}>
        <svg width={avatarSize} height={avatarSize} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-border)" strokeWidth={4} />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={4}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          inset: avatarInset,
          borderRadius: '50%',
          background: 'var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <MemberIcon id={memberKey} size={isCompact ? 30 : 40} />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, textAlign: isCompact ? 'center' : 'left' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCompact ? 'center' : 'flex-start',
          gap: 'var(--space-sm)',
          marginBottom: 2,
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-micro)',
            color: 'var(--color-surface)',
            background: 'var(--color-primary)',
            borderRadius: 'var(--radius-pill)',
            padding: '1px 8px',
          }}>
            LVL {level}
          </span>
          <span style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {pct}%
          </span>
        </div>
        <h2 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-subheading)',
          color: 'var(--color-text)',
          margin: '0 0 2px',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          whiteSpace: isCompact ? 'normal' : 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {member?.name ?? memberKey}
        </h2>
        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-sm)' }}>
          {member?.role}
          {member?.roleType && (
            <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', textTransform: 'uppercase', marginLeft: 6 }}>
              · {member.roleType}
            </span>
          )}
        </p>
        <div style={{ height: 3, borderRadius: 99, background: 'var(--color-border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--color-primary)',
            borderRadius: 99,
            transition: 'width 0.6s ease',
          }} />
        </div>
        <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
          {xp} / {xpToNext} XP
        </p>
      </div>
    </div>
  );
}
