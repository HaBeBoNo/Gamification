import { useEffect, useRef } from 'react';
import { S, useGameStore } from '@/state/store';
import { supabase } from '@/lib/supabase';
import type { FeedEntry } from '@/types/game';

function getFeedFingerprint(item: FeedEntry): string {
  const createdAt = item.ts && !Number.isNaN(new Date(item.ts).getTime())
    ? new Date(item.ts).toISOString()
    : new Date().toISOString();

  return [
    item.syncId || 'legacy',
    item.who || '',
    item.action || '',
    item.xp ?? 0,
    createdAt,
  ].join('|');
}

export function useFeedSync() {
  // Prenumerera på tick så hooken körs om vid varje save()/notify()
  const tick = useGameStore(s => s.tick);
  const initialized = useRef(false);
  const syncedFingerprints = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase || !S.feed || !S.me) return;

    if (!initialized.current) {
      S.feed.forEach(item => {
        syncedFingerprints.current.add(getFeedFingerprint(item));
      });
      initialized.current = true;
      return;
    }

    const newItems = S.feed.filter(item => !syncedFingerprints.current.has(getFeedFingerprint(item)));
    if (newItems.length === 0) return;

    async function syncItems() {
      for (const item of [...newItems].reverse()) {
        const createdAt = item.ts && !Number.isNaN(new Date(item.ts).getTime())
          ? new Date(item.ts).toISOString()
          : new Date().toISOString();

        const fingerprint = getFeedFingerprint({ ...item, ts: createdAt });
        if (syncedFingerprints.current.has(fingerprint)) continue;

        const { data: existing, error: selectError } = await supabase
          .from('activity_feed')
          .select('id')
          .eq('who', item.who ?? S.me)
          .eq('action', item.action)
          .eq('xp', item.xp ?? 0)
          .eq('created_at', createdAt)
          .limit(1);

        if (selectError) {
          console.error('[FeedSync] select error:', selectError);
          continue;
        }

        if (!existing || existing.length === 0) {
          const { error } = await supabase.from('activity_feed').insert({
            who: item.who ?? S.me,
            action: item.action,
            xp: item.xp ?? 0,
            created_at: createdAt,
          });

          if (error) {
            console.error('[FeedSync] insert error:', error);
            continue;
          }
        }

        syncedFingerprints.current.add(fingerprint);
      }
    }

    void syncItems();
  }, [tick, S.me]);
}
