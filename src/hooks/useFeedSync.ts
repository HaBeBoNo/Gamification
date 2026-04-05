import { useEffect, useRef } from 'react';
import { S, useGameStore } from '@/state/store';
import { supabase } from '@/lib/supabase';

export function useFeedSync() {
  // Prenumerera på tick så hooken körs om vid varje save()/notify()
  const tick = useGameStore(s => s.tick);
  const lastSyncedLength = useRef(0);

  useEffect(() => {
    const feed = S.feed;
    const me = S.me;
    if (!feed || !me) return;
    if (feed.length <= lastSyncedLength.current) return;

    // Synka bara nya items (de som tillkommit sedan senaste sync)
    const newItems = feed.slice(lastSyncedLength.current);
    lastSyncedLength.current = feed.length;

    for (const item of newItems) {
      // item.ts är HH:MM — använd alltid aktuell tid som created_at
      supabase.from('activity_feed').insert({
        who: item.who ?? me,
        action: item.action,
        xp: item.xp ?? 0,
        created_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.error('Feed sync error:', error);
      });
    }
  }, [tick]);
}
