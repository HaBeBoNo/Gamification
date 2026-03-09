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
    <button className="notif-bell" onClick={onClick} aria-label="Notifikationer">
      <Bell size={20} strokeWidth={1.5} />
      {count > 0 && (
        <span className={`notif-bell-badge ${pulse ? 'pulse' : ''}`}>
          {display}
        </span>
      )}
    </button>
  );
}
