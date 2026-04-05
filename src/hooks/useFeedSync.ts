import { useEffect, useRef } from 'react';
import { S, useGameStore } from '@/state/store';
import { supabase } from '@/lib/supabase';

export function useFeedSync() {
  // Prenumerera på tick så hooken körs om vid varje save()/notify()
  const tick = useGameStore(s => s.tick);
  const lastSyncedLength = useRef(0);

  useEffect(() => {
    if (!S.feed || !S.me) return;
    if (S.feed.length <= lastSyncedLength.current) return;

    const newItems = S.feed.slice(lastSyncedLength.current);
    lastSyncedLength.current = S.feed.length;

    for (const item of newItems) {
      supabase.from('activity_feed').insert({
        who: item.who ?? S.me,
        action: item.action,
        xp: item.xp ?? 0,
        created_at: item.ts && !isNaN(new Date(item.ts).getTime())
          ? new Date(item.ts).toISOString()
          : new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.error('[FeedSync] insert error:', error);
      });
    }
  }, [tick, S.me]);
}
