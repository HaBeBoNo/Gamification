import { useEffect } from 'react';
import { S, useGameStore } from '@/state/store';
import { fetchActivePresenceMembers, upsertPresence } from '@/lib/socialData';
import { fireAndForget } from '@/lib/async';
import { CoachPolicy } from '@/lib/coach';
import { supabase } from '@/lib/supabase';

const HEARTBEAT_MS = 45_000;
const ACTIVE_WINDOW_MINUTES = 5;

export function usePresenceSync(currentSurface: string) {
  const setPresenceMembers = useGameStore((state) => state.setPresenceMembers);
  const upsertPresenceMember = useGameStore((state) => state.upsertPresenceMember);
  const removePresenceMember = useGameStore((state) => state.removePresenceMember);

  useEffect(() => {
    if (!S.me || !currentSurface) return;

    let intervalId: number | null = null;
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function refreshPresenceSnapshot() {
      const result = await fetchActivePresenceMembers(ACTIVE_WINDOW_MINUTES);
      if (cancelled) return;
      setPresenceMembers(result.members);
    }

    const heartbeat = (isOnline = true) => {
      if (!S.me || cancelled) return;
      const nowIso = new Date().toISOString();
      if (isOnline) {
        CoachPolicy.recordSurfaceActivity(S.me, currentSurface, Date.now());
        upsertPresenceMember({
          member_key: S.me,
          current_surface: currentSurface,
          is_online: true,
          last_seen_at: nowIso,
          updated_at: nowIso,
          metadata: {
            visibility: document.visibilityState,
          },
        });
      } else {
        removePresenceMember(S.me);
      }
      fireAndForget(upsertPresence({
        memberKey: S.me,
        currentSurface,
        isOnline,
        metadata: {
          visibility: document.visibilityState,
        },
      }), 'presence heartbeat');
    };

    fireAndForget(refreshPresenceSnapshot(), 'presence snapshot refresh');
    heartbeat(true);
    intervalId = window.setInterval(() => heartbeat(document.visibilityState === 'visible'), HEARTBEAT_MS);

    const scheduleRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        fireAndForget(refreshPresenceSnapshot(), 'presence snapshot refresh');
      }, 80);
    };

    const channel = supabase
      ? supabase
          .channel(`presence-sync:${S.me}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'member_presence',
          }, scheduleRefresh)
          .subscribe()
      : null;

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
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('offline', handleOffline);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
      heartbeat(false);
      cancelled = true;
    };
  }, [currentSurface, removePresenceMember, setPresenceMembers, upsertPresenceMember]);
}
