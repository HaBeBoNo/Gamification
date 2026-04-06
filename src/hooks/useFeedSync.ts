import { useEffect, useRef } from 'react';
import { S, useGameStore } from '@/state/store';
import { supabase } from '@/lib/supabase';
import type { FeedEntry } from '@/types/game';
import { getFeedCommentMeta, getFeedContextLabel } from '@/lib/feed';

function getTimestampCandidate(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function getTimestampFromIdentity(identity?: string): string | null {
  if (!identity) return null;
  const match = identity.match(/(\d{13})/);
  if (!match) return null;
  const parsed = new Date(Number(match[1]));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function resolveFeedCreatedAt(item: Partial<FeedEntry>): string {
  return (
    getTimestampCandidate(item.created_at) ||
    getTimestampCandidate(item.ts) ||
    getTimestampCandidate(item.time) ||
    getTimestampFromIdentity(item.syncId) ||
    getTimestampFromIdentity(item.id) ||
    new Date(0).toISOString()
  );
}

function getFeedFingerprint(item: FeedEntry): string {
  return [
    item.syncId || item.id || 'legacy',
    item.who || '',
    item.action || '',
    item.xp ?? 0,
    resolveFeedCreatedAt(item),
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
        const createdAt = resolveFeedCreatedAt(item);

        const fingerprint = getFeedFingerprint({ ...item, ts: createdAt });
        if (syncedFingerprints.current.has(fingerprint)) continue;
        const commentMeta = getFeedCommentMeta(item);
        const contextLabel = item.context_label || getFeedContextLabel(item);
        const metadata = item.metadata && typeof item.metadata === 'object'
          ? item.metadata
          : {};

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
            interaction_type: commentMeta ? 'comment' : item.interaction_type || 'activity',
            parent_feed_item_id: commentMeta?.parentFeedItemId || item.parent_feed_item_id || null,
            context_label: contextLabel || null,
            comment_body: commentMeta?.comment || item.comment_body || null,
            target_member_key: commentMeta?.targetKey || item.target_member_key || null,
            metadata,
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
