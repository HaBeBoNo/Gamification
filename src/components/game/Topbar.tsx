import React from 'react';
import { S } from '@/state/store';
import { Bell, Flame } from 'lucide-react';

interface TopbarProps {
  logoRef?: (node: HTMLButtonElement | null) => void;
  onNotifications?: () => void;
  onLogoClick?: () => void;
}

export default function Topbar({ logoRef, onNotifications, onLogoClick }: TopbarProps) {
  const me = S.me;
  const char = me ? S.chars[me] : null;
  const streak = char?.streak ?? 0;
  const operationLabel = S.operationName;
  const weekNumber = S.weekNum;

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      paddingTop: 'max(var(--space-sm), env(safe-area-inset-top))',
    }}>
      {/* Huvudrad */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-sm) var(--layout-gutter-mobile)',
        minHeight: 'var(--topbar-height)',
        gap: 'var(--space-md)',
      }}>
        {/* Vänster — logotyp */}
        <button
          ref={logoRef}
          onClick={onLogoClick}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 0 }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.08em' }}>
            SEKTIONEN
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-micro)',
            color: 'var(--color-text-muted)',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}>
            HQ · {operationLabel} · V{weekNumber}
          </span>
        </button>

        {/* Höger — streak + notis */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexShrink: 0 }}>
          {/* Streak */}
          {streak > 0 && (
            <div
              title="Aktiv varje dag — missa inte din streak!"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'var(--color-surface-elevated)',
                borderRadius: 'var(--radius-pill)',
                minHeight: '32px',
                padding: '0 10px',
                fontSize: 'var(--text-micro)',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-mono)',
              }}>
              <Flame size={12} strokeWidth={2} />
              {streak}
            </div>
          )}
          {/* Notis-klocka */}
          {onNotifications && (
            <button
              onClick={onNotifications}
              style={{
                width: 'var(--icon-button-size)',
                height: 'var(--icon-button-size)',
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: '999px',
                cursor: 'pointer',
                padding: 0,
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
