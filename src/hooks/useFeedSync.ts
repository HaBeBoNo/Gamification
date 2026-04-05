import { useEffect, useRef } from 'react';
import { S, useGameStore } from '@/state/store';
import { supabase } from '@/lib/supabase';

export function useFeedSync() {
  // Prenumerera på tick så hooken körs om vid varje save()/notify()
  const tick = useGameStore(s => s.tick);
  const lastSyncedLength = useRef(0);

  useEffect(() => {
    console.log('[FeedSync] tick fired, feed length:', S.feed?.length, 'me:', S.me, 'lastSynced:', lastSyncedLength.current);

    if (!S.feed || !S.me) {
      console.log('[FeedSync] abort — feed or me missing');
      return;
    }
    if (S.feed.length <= lastSyncedLength.current) {
      console.log('[FeedSync] abort — no new items');
      return;
    }

    const newItems = S.feed.slice(lastSyncedLength.current);
    console.log('[FeedSync] syncing', newItems.length, 'new items:', newItems);
    lastSyncedLength.current = S.feed.length;

    for (const item of newItems) {
      console.log('[FeedSync] inserting item:', item);
      supabase.from('activity_feed').insert({
        who: item.who ?? S.me,
        action: item.action,
        xp: item.xp ?? 0,
        created_at: item.ts && !isNaN(new Date(item.ts).getTime())
          ? new Date(item.ts).toISOString()
          : new Date().toISOString(),
      }).then(({ error, data }) => {
        if (error) console.error('[FeedSync] insert error:', error);
        else console.log('[FeedSync] insert success:', data);
      });
    }
  }, [tick, S.me]);
}
