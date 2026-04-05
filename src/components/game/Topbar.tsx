import React from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { Bell } from 'lucide-react';
import NotificationBell from './NotificationBell';

interface TopbarProps {
  rerender: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAdmin: () => void;
  logoRef?: (node: any) => void;
  onNotifications?: () => void;
  onLogoClick?: () => void;
}

export default function Topbar({ onAdmin, logoRef, onNotifications, onLogoClick }: TopbarProps) {
  const me = S.me;
  const char = me ? S.chars[me] : null;
  const streak = char?.streak ?? 0;
  const isAdmin = me === 'hannes';
  const operationLabel = S.operationName;
  const weekNumber = S.weekNum;

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
    }}>
      {/* Huvudrad */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-sm) var(--space-md)',
        height: 48,
      }}>
        {/* Vänster — logotyp */}
        <button
          ref={logoRef}
          onClick={onLogoClick}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.08em' }}>
              SEKTIONEN
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>
              HQ · {operationLabel} · V{weekNumber}
            </span>
          </div>
        </button>

        {/* Höger — streak + notis + admin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {/* Streak */}
          {streak > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--color-surface-elevated)',
              borderRadius: 'var(--radius-pill)',
              padding: '3px 8px',
              fontSize: 'var(--text-micro)',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              🔥 {streak}
            </div>
          )}
          {/* Notis-klocka */}
          {onNotifications && (
            <button onClick={onNotifications} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-muted)' }}>
              <Bell size={18} />
            </button>
          )}
          {/* Admin — bara för Hannes */}
          {isAdmin && (
            <button onClick={onAdmin} style={{
              background: 'none',
              border: '1px solid var(--color-accent)',
              borderRadius: 'var(--radius-pill)',
              padding: '3px 10px',
              fontSize: 'var(--text-micro)',
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              letterSpacing: '0.06em',
            }}>
              ADMIN
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
