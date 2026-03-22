import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { getUnreadCount, subscribeNotifications } from '@/state/notifications';

interface Props {
  onClick: () => void;
}

export default function NotificationBell({ onClick }: Props) {
  const [count, setCount] = useState(getUnreadCount());
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    return subscribeNotifications(() => {
      const newCount = getUnreadCount();
      if (newCount > count) {
        setPulse(true);
        setTimeout(() => setPulse(false), 300);
      }
      setCount(newCount);
    });
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
        padding: '10px', // Increased padding for better size
        touchAction: 'manipulation',
      }}
    >
      <Bell size={22} strokeWidth={count > 0 ? 2 : 1.5} />
      {count > 0 && (
        <span
          className="notif-bell-badge"
          style={{
            position: 'absolute',
            top: '-5px', // Adjusted top positioning
            right: '-5px', // Adjusted right positioning
            background: '#ff4444',
            color: '#fff',
            borderRadius: '999px',
            fontSize: '12px', // Increased font size for badge
            fontWeight: 700,
            minWidth: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 6px', // Adjusted padding for badge
            fontFamily: 'var(--font-ui)',
          }}
        >
          {display}
        </span>
      )}
    </button>
  );
}