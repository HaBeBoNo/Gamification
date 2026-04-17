import { useEffect, useRef } from 'react';
import { S, useGameStore } from '@/state/store';
import { supabase } from '@/lib/supabase';
import { fireAndForget } from '@/lib/async';
import type { FeedEntry } from '@/types/game';
import { getFeedCommentMeta, getFeedContextLabel } from '@/lib/feed';
import { hydrateFeedItems } from '@/lib/socialData';

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

function isUnsyncedLocalItem(item: FeedEntry, syncedFingerprints: Set<string>): boolean {
  const itemId = String(item.id || '');
  if (!itemId) return true;
  return !syncedFingerprints.has(getFeedFingerprint(item));
}

export function useFeedSync() {
  const me = S.me;
  const feed = useGameStore((state) => state.feed);
  const feedHydrated = useGameStore((state) => state.feedHydrated);
  const setFeed = useGameStore((state) => state.setFeed);
  const syncedFingerprints = useRef<Set<string>>(new Set());
  const bootstrapped = useRef(false);

  useEffect(() => {
    syncedFingerprints.current = new Set();
    bootstrapped.current = false;
  }, [me]);

  useEffect(() => {
    if (!supabase || !me || bootstrapped.current) return;

    let cancelled = false;

    async function bootstrapFeed() {
      const localFeed = useGameStore.getState().feed;

      try {
        const { data, error } = await supabase
          .from('activity_feed')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const hydratedFeed = await hydrateFeedItems((data as FeedEntry[]) || []);
        if (cancelled) return;

        hydratedFeed.forEach((item) => {
          syncedFingerprints.current.add(getFeedFingerprint(item));
        });

        const unsyncedLocal = localFeed.filter((item) => isUnsyncedLocalItem(item, syncedFingerprints.current));
        setFeed([...hydratedFeed, ...unsyncedLocal]);
      } catch (error) {
        console.error('[FeedSync] bootstrap error:', error);
        if (!cancelled) {
          setFeed(localFeed);
        }
      } finally {
        if (!cancelled) {
          bootstrapped.current = true;
        }
      }
    }

    fireAndForget(bootstrapFeed(), 'bootstrap feed sync');

    return () => {
      cancelled = true;
    };
  }, [me, setFeed]);

  useEffect(() => {
    if (!supabase || !me || !feedHydrated || !bootstrapped.current) return;

    const newItems = feed.filter(item => !syncedFingerprints.current.has(getFeedFingerprint(item)));
    if (newItems.length === 0) return;

    async function syncItems() {
      let syncedAny = false;

      for (const item of [...newItems].reverse()) {
        const createdAt = resolveFeedCreatedAt(item);
        const syncId = item.syncId || null;

        const fingerprint = getFeedFingerprint({ ...item, ts: createdAt });
        if (syncedFingerprints.current.has(fingerprint)) continue;
        const commentMeta = getFeedCommentMeta(item);
        const contextLabel = item.context_label || getFeedContextLabel(item);
        const metadata = {
          ...(item.metadata && typeof item.metadata === 'object' ? item.metadata : {}),
          ...(syncId ? { syncId } : {}),
        };
        const category = item.category || item.type || null;

        const existingQuery = syncId
          ? supabase
              .from('activity_feed')
              .select('id')
              .contains('metadata', { syncId })
              .limit(1)
          : supabase
              .from('activity_feed')
              .select('id')
              .eq('who', item.who ?? me)
              .eq('action', item.action)
              .eq('xp', item.xp ?? 0)
              .eq('created_at', createdAt)
              .limit(1);

        const { data: existing, error: selectError } = await existingQuery;

        if (selectError) {
          console.error('[FeedSync] select error:', selectError);
          continue;
        }

        if (!existing || existing.length === 0) {
          const { error } = await supabase.from('activity_feed').insert({
            who: item.who ?? me,
            action: item.action,
            xp: item.xp ?? 0,
            category,
            created_at: createdAt,
            interaction_type: commentMeta ? 'comment' : item.interaction_type || 'activity',
            parent_feed_item_id: commentMeta?.parentFeedItemId || item.parent_feed_item_id || null,
            context_label: contextLabel || null,
            comment_body: commentMeta?.comment || item.comment_body || null,
            target_member_key: commentMeta?.targetKey || item.target_member_key || null,
            meta: metadata,
            metadata,
          });

          if (error) {
            console.error('[FeedSync] insert error:', error);
            continue;
          }
        }

        syncedFingerprints.current.add(fingerprint);
        syncedAny = true;
      }

      if (!syncedAny) return;

      try {
        const { data, error } = await supabase
          .from('activity_feed')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const hydratedFeed = await hydrateFeedItems((data as FeedEntry[]) || []);
        hydratedFeed.forEach((item) => {
          syncedFingerprints.current.add(getFeedFingerprint(item));
        });

        const localUnsynced = useGameStore
          .getState()
          .feed
          .filter((item) => isUnsyncedLocalItem(item, syncedFingerprints.current));

        setFeed([...hydratedFeed, ...localUnsynced]);
      } catch (error) {
        console.error('[FeedSync] post-sync refresh error:', error);
      }
    }

    fireAndForget(syncItems(), 'sync local feed items');
  }, [feed, feedHydrated, me, setFeed]);

  useEffect(() => {
    if (!supabase || !me) return;

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function refreshFeedFromServer() {
      try {
        const { data, error } = await supabase
          .from('activity_feed')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        const hydratedFeed = await hydrateFeedItems((data as FeedEntry[]) || []);
        if (cancelled) return;

        hydratedFeed.forEach((item) => {
          syncedFingerprints.current.add(getFeedFingerprint(item));
        });

        const localUnsynced = useGameStore
          .getState()
          .feed
          .filter((item) => isUnsyncedLocalItem(item, syncedFingerprints.current));

        setFeed([...hydratedFeed, ...localUnsynced]);
      } catch (error) {
        console.error('[FeedSync] realtime refresh error:', error);
      }
    }

    function scheduleRefresh() {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        fireAndForget(refreshFeedFromServer(), 'refresh feed from server');
      }, 80);
    }

    const channel = supabase
      .channel('feed-store-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activity_feed',
      }, scheduleRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feed_reactions',
      }, scheduleRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feed_witnesses',
      }, scheduleRefresh)
      .subscribe();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [me, setFeed]);
}
