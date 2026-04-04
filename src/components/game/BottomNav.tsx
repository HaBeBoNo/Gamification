import React from 'react';
import { Target, Trophy, Globe, MoreHorizontal } from 'lucide-react';

const TABS = [
  { id: 'quests',      label: 'QUESTS',    icon: Target },
  { id: 'bandhub',     label: 'BAND HUB',  icon: Globe },
  { id: 'leaderboard', label: 'RANKING',   icon: Trophy },
];

interface BottomNavProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  showMore: boolean;
  onMoreTap: () => void;
  unreadCount?: number;
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '2px',
  background: 'none',
  border: 'none',
  color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, var(--font-mono))',
  letterSpacing: '0.05em',
  padding: '8px 4px',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
  cursor: 'pointer',
  flex: 1,
  minHeight: 44,
});

export function BottomNav({ activeTab, onTabChange, showMore, onMoreTap, unreadCount = 0 }: BottomNavProps) {
  return (
    <nav
      className="bottom-tab-bar"
      role="tablist"
      aria-label="Huvudnavigering"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(56px + env(safe-area-inset-bottom))',
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-around',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id && !showMore;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            onClick={() => onTabChange(id)}
            style={tabStyle(active)}
          >
            <Icon size={22} strokeWidth={active ? 2 : 1.5} />
            {label}
          </button>
        );
      })}

      {/* More / overflow button */}
      <button
        role="tab"
        aria-selected={showMore}
        aria-label="Mer"
        onClick={onMoreTap}
        style={tabStyle(showMore)}
      >
        <span className="tab-badge-wrap" style={{ position: 'relative', lineHeight: 0 }}>
          <MoreHorizontal size={22} strokeWidth={showMore ? 2 : 1.5} />
          {unreadCount > 0 && <span className="more-notif-dot" />}
        </span>
        MER
      </button>
    </nav>
  );
}
