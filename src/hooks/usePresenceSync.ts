import { useEffect } from 'react';
import { S } from '@/state/store';
import { upsertPresence } from '@/lib/socialData';
import { CoachPolicy } from '@/lib/coach';

const HEARTBEAT_MS = 45_000;

export function usePresenceSync(currentSurface: string) {
  useEffect(() => {
    if (!S.me || !currentSurface) return;

    let intervalId: number | null = null;
    let cancelled = false;

    const heartbeat = (isOnline = true) => {
      if (!S.me || cancelled) return;
      if (isOnline) {
        CoachPolicy.recordSurfaceActivity(S.me, currentSurface, Date.now());
      }
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

    const handlePageHide = () => {
      heartbeat(false);
    };

    const handleOffline = () => {
      heartbeat(false);
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('offline', handleOffline);
      heartbeat(false);
      cancelled = true;
    };
  }, [currentSurface]);
}
