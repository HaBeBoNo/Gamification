import { useEffect } from 'react';
import { S } from '@/state/store';
import { upsertPresence } from '@/lib/socialData';

const HEARTBEAT_MS = 45_000;

export function usePresenceSync(currentSurface: string) {
  useEffect(() => {
    if (!S.me || !currentSurface) return;

    let intervalId: number | null = null;
    let cancelled = false;

    const heartbeat = (isOnline = true) => {
      if (!S.me || cancelled) return;
      void upsertPresence({
        memberKey: S.me,
        currentSurface,
        isOnline,
        metadata: {
          visibility: document.visibilityState,
        },
      });
    };

    heartbeat(true);
    intervalId = window.setInterval(() => heartbeat(document.visibilityState === 'visible'), HEARTBEAT_MS);

    const handleVisibility = () => {
      heartbeat(document.visibilityState === 'visible');
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      heartbeat(false);
      cancelled = true;
    };
  }, [currentSurface]);
}
