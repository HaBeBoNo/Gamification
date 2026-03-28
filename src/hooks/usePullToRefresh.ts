import { useState, useRef, useCallback, type TouchEvent } from 'react';
import { syncFromSupabase } from '@/hooks/useSupabaseSync';
import { notify } from '@/state/store';

const PULL_THRESHOLD = 80; // px downward drag to trigger refresh

/**
 * usePullToRefresh — hanterar pull-to-refresh-logiken för mobilvyn.
 *
 * Returnerar tre stabila event-handlers att fästa på scroll-containern,
 * samt `refreshing`-flaggan för att visa laddningsindikator.
 *
 * @param memberKey - Inloggad användares nyckel (S.me). Null inaktiverar sync.
 */
export function usePullToRefresh(memberKey: string | null) {
  const [refreshing, setRefreshing] = useState(false);

  const pullStartY = useRef(0);
  const pullCurrentY = useRef(0);
  const isPulling = useRef(false);

  const handlePullStart = useCallback((e: TouchEvent<HTMLElement>) => {
    const scrollEl = e.currentTarget as HTMLElement;
    if (scrollEl.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handlePullMove = useCallback((e: TouchEvent<HTMLElement>) => {
    if (!isPulling.current) return;
    pullCurrentY.current = e.touches[0].clientY;
  }, []);

  const handlePullEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    const pullDistance = pullCurrentY.current - pullStartY.current;

    if (pullDistance > PULL_THRESHOLD && memberKey) {
      setRefreshing(true);
      try {
        await syncFromSupabase(memberKey);
        notify();
      } catch {}
      setRefreshing(false);
    }

    pullStartY.current = 0;
    pullCurrentY.current = 0;
  }, [memberKey]);

  return { refreshing, handlePullStart, handlePullMove, handlePullEnd };
}
