import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getFeedContextLabel, getFeedMemberName, parseFeedCommentAction } from '@/lib/feed';
import { addNotification, getNotifications, NOTIF_TYPES } from '@/state/notifications';
import { S } from '@/state/store';
import { getSocialBackfillCutoff, setLastSocialSignalSync } from '@/lib/socialSignalPolicy';

function getActivityTs(item: any): number {
  const raw = item?.created_at || item?.ts || item?.time || item?.t;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function hasNotification(type: string, dedupeKey: string): boolean {
  return getNotifications().some((notif) =>
    notif.type === type && notif.payload?.dedupeKey === dedupeKey
  );
}

export function useSocialNotifications() {
  const initialized = useRef(false);
  const seenCommentIds = useRef<Set<string>>(new Set());
  const seenReactionKeys = useRef<Set<string>>(new Set());
  const seenWitnessKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase || !S.me) return;

    initialized.current = false;
    seenCommentIds.current = new Set();
    seenReactionKeys.current = new Set();
    seenWitnessKeys.current = new Set();
    const backfillCutoffTs = getSocialBackfillCutoff(S.me);

    function maybePersistSync(ts = Date.now()) {
      if (!S.me) return;
      setLastSocialSignalSync(S.me, ts);
    }

    function createCommentNotification(item: any, parsedComment: NonNullable<ReturnType<typeof parseFeedCommentAction>>, eventTs: number) {
      const itemId = String(item.id || '');
      const dedupeKey = `comment:${itemId}`;
      if (hasNotification(NOTIF_TYPES.FEED_COMMENT, dedupeKey)) return;

      addNotification({
        type: NOTIF_TYPES.FEED_COMMENT,
        title: `${getFeedMemberName(item.who)} kommenterade din aktivitet`,
        body: parsedComment.comment,
        memberKey: S.me!,
        ts: eventTs || Date.now(),
        payload: {
          dedupeKey,
          memberId: item.who,
          comment: parsedComment.comment,
          contextLabel: parsedComment.contextLabel,
          feedEventId: itemId,
        },
      });
    }

    function createReactionNotification(item: any, memberId: string, emoji: string, eventTs: number) {
      const itemId = String(item.id || '');
      const dedupeKey = `reaction:${itemId}|${emoji}|${memberId}`;
      if (hasNotification(NOTIF_TYPES.FEED_REACTION, dedupeKey)) return;

      addNotification({
        type: NOTIF_TYPES.FEED_REACTION,
        title: `${getFeedMemberName(memberId)} reagerade på din aktivitet`,
        body: `${emoji} på ${getFeedContextLabel(item)}`,
        memberKey: S.me!,
        ts: eventTs || Date.now(),
        payload: {
          dedupeKey,
          memberId,
          emoji,
          contextLabel: getFeedContextLabel(item),
          feedItemId: itemId,
        },
      });
    }

    function createWitnessNotification(item: any, memberId: string, eventTs: number) {
      const itemId = String(item.id || '');
      const dedupeKey = `witness:${itemId}|${memberId}`;
      if (hasNotification(NOTIF_TYPES.FEED_WITNESS, dedupeKey)) return;

      addNotification({
        type: NOTIF_TYPES.FEED_WITNESS,
        title: `${getFeedMemberName(memberId)} såg din aktivitet`,
        body: `På ${getFeedContextLabel(item)}`,
        memberKey: S.me!,
        ts: eventTs || Date.now(),
        payload: {
          dedupeKey,
          memberId,
          contextLabel: getFeedContextLabel(item),
          feedItemId: itemId,
        },
      });
    }

    function seedItem(item: any, allowBackfill = false) {
      const itemId = String(item.id || '');
      const parsedComment = parseFeedCommentAction(item.action);
      const eventTs = getActivityTs(item);

      if (parsedComment?.targetKey === S.me && itemId) {
        seenCommentIds.current.add(itemId);
        if (allowBackfill && item.who !== S.me && eventTs >= backfillCutoffTs) {
          createCommentNotification(item, parsedComment, eventTs);
        }
      }

      if (item.who === S.me && itemId) {
        Object.entries(item.reactions ?? {}).forEach(([emoji, memberIds]) => {
          (memberIds as string[])
            .filter((memberId) => memberId && memberId !== S.me)
            .forEach((memberId) => {
              const key = `${itemId}|${emoji}|${memberId}`;
              seenReactionKeys.current.add(key);
              if (allowBackfill && eventTs >= backfillCutoffTs) {
                createReactionNotification(item, memberId, emoji, eventTs);
              }
            });
        });

        (item.witnesses ?? [])
          .filter((memberId: string) => memberId && memberId !== S.me)
          .forEach((memberId: string) => {
            const key = `${itemId}|${memberId}`;
            seenWitnessKeys.current.add(key);
            if (allowBackfill && eventTs >= backfillCutoffTs) {
              createWitnessNotification(item, memberId, eventTs);
            }
          });
      }
    }

    function handleInsert(item: any) {
      const itemId = String(item.id || '');
      const parsedComment = parseFeedCommentAction(item.action);
      const eventTs = getActivityTs(item) || Date.now();

      if (parsedComment?.targetKey === S.me && itemId && !seenCommentIds.current.has(itemId)) {
        seenCommentIds.current.add(itemId);
        createCommentNotification(item, parsedComment, eventTs);
        maybePersistSync(eventTs);
      }
    }

    function handleUpdate(item: any) {
      if (item.who !== S.me) return;
      const itemId = String(item.id || '');
      if (!itemId) return;
      const eventTs = Date.now();

      Object.entries(item.reactions ?? {}).forEach(([emoji, memberIds]) => {
        (memberIds as string[])
          .filter((memberId) => memberId && memberId !== S.me)
          .forEach((memberId) => {
            const key = `${itemId}|${emoji}|${memberId}`;
            if (seenReactionKeys.current.has(key)) return;
            seenReactionKeys.current.add(key);
            createReactionNotification(item, memberId, emoji, eventTs);
            maybePersistSync(eventTs);
          });
      });

      (item.witnesses ?? [])
        .filter((memberId: string) => memberId && memberId !== S.me)
        .forEach((memberId: string) => {
          const key = `${itemId}|${memberId}`;
          if (seenWitnessKeys.current.has(key)) return;
          seenWitnessKeys.current.add(key);
          createWitnessNotification(item, memberId, eventTs);
          maybePersistSync(eventTs);
        });
    }

    async function seed() {
      const { data, error } = await supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('[SocialNotifications] Seed failed:', error.message);
        initialized.current = true;
        return;
      }

      [...(data || [])]
        .sort((a, b) => getActivityTs(a) - getActivityTs(b))
        .forEach((item) => seedItem(item, true));
      initialized.current = true;
      maybePersistSync(Date.now());
    }

    void seed();

    const channel = supabase
      .channel('social-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_feed',
      }, (payload) => {
        if (!initialized.current) return;
        handleInsert(payload.new as any);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'activity_feed',
      }, (payload) => {
        if (!initialized.current) return;
        handleUpdate(payload.new as any);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [S.me]);
}
