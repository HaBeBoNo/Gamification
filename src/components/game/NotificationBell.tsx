import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useGameStore } from '@/state/store';

interface Props {
  onClick: () => void;
}

export default function NotificationBell({ onClick }: Props) {
  // Reactive: re-renders whenever notifications slice changes in Zustand
  const count = useGameStore(s => s.notifications.filter(n => !n.read).length);
  const [pulse, setPulse] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 300);
      return () => clearTimeout(t);
    }
    prevCount.current = count;
  }, [count]);

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
        color: count > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
        cursor: 'pointer',
        padding: '10px',
        touchAction: 'manipulation',
      }}
    >
      <Bell size={22} strokeWidth={count > 0 ? 2 : 1.5} />
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
    </button>
  );
}
