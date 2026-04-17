import { useEffect, useState } from 'react';
import { S, useGameStore } from '@/state/store';
import { supabase } from '@/lib/supabase';
import { fireAndForget } from '@/lib/async';
import { fetchSharedBandActivitySnapshot } from '@/lib/socialData';
import type { FeedEntry } from '@/types/game';

export function useActivityFeedData() {
  const feedItems = useGameStore((state) => state.feed);
  const feedHydrated = useGameStore((state) => state.feedHydrated);
  const presenceMembers = useGameStore((state) => state.presenceMembers);
  const presenceHydrated = useGameStore((state) => state.presenceHydrated);
  const setFeed = useGameStore((state) => state.setFeed);
  const [bandSnapshot, setBandSnapshot] = useState<{ activeToday: number; activeNow: number | null; xp48h: number }>({
    activeToday: 0,
    activeNow: null,
    xp48h: 0,
  });

  useEffect(() => {
    if (!S.me || !supabase) return;
    async function loadBandSnapshot(options?: { forceFresh?: boolean }) {
      const snapshot = await fetchSharedBandActivitySnapshot(48, 5, options);
      setBandSnapshot(snapshot);
    }

    fireAndForget(loadBandSnapshot(), 'load activity band snapshot');

    const channel = supabase
      .channel('activity-band-snapshot')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activity_feed',
      }, () => {
        fireAndForget(loadBandSnapshot({ forceFresh: true }), 'refresh activity band snapshot');
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'member_presence',
      }, () => {
        fireAndForget(loadBandSnapshot({ forceFresh: true }), 'refresh activity band snapshot');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  function setFeedItems(updater: FeedEntry[] | ((prev: FeedEntry[]) => FeedEntry[])) {
    const nextFeed = typeof updater === 'function'
      ? updater(useGameStore.getState().feed)
      : updater;
    setFeed(nextFeed);
  }

  return {
    feedItems,
    setFeedItems,
    loading: !feedHydrated,
    bandSnapshot: {
      ...bandSnapshot,
      activeNow: presenceHydrated ? presenceMembers.length : bandSnapshot.activeNow,
    },
  };
}
