import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useGameStore } from '@/state/store';

interface Props {
  onClick: () => void;
  count?: number;
  hasAttention?: boolean;
}

export default function NotificationBell({ onClick, count: countProp, hasAttention }: Props) {
  // Reactive: re-renders whenever notifications slice changes in Zustand
  const storeCount = useGameStore(s => s.notifications.filter(n => !n.read).length);
  const count = countProp ?? storeCount;
  const isActive = hasAttention ?? count > 0;
  const [pulse, setPulse] = useState(false);
  const prevState = useRef({ count, isActive });

  useEffect(() => {
    if (count > prevState.current.count || (isActive && !prevState.current.isActive)) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 300);
      prevState.current = { count, isActive };
      return () => clearTimeout(t);
    }
    prevState.current = { count, isActive };
  }, [count, isActive]);

  const display = count > 9 ? '9+' : count;

  return (
    <button
      className={`notif-bell ${pulse ? 'pulse' : ''}`}
      onClick={onClick}
      aria-label="Notifikationer"
      style={{
        position: 'relative',
        background: 'none',
        border: 'none',
        color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
        cursor: 'pointer',
        padding: '10px',
        touchAction: 'manipulation',
      }}
    >
      <Bell size={22} strokeWidth={isActive ? 2 : 1.5} />
      {count > 0 && (
        <span
          className="notif-bell-badge"
          style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#ff4444',
            color: '#fff',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            minWidth: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {display}
        </span>
      )}
      {count === 0 && isActive && (
        <span
          className="notif-bell-dot"
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-1px',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--color-primary)',
            boxShadow: '0 0 0 2px var(--color-surface)',
          }}
        />
      )}
    </button>
  );
}
