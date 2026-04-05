import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getFeedContextLabel, getFeedMemberName, parseFeedCommentAction } from '@/lib/feed';
import { addNotification, getNotifications, NOTIF_TYPES } from '@/state/notifications';
import { S } from '@/state/store';

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

    function seedItem(item: any) {
      const itemId = String(item.id || '');
      const parsedComment = parseFeedCommentAction(item.action);

      if (parsedComment?.targetKey === S.me && itemId) {
        seenCommentIds.current.add(itemId);
      }

      if (item.who === S.me && itemId) {
        Object.entries(item.reactions ?? {}).forEach(([emoji, memberIds]) => {
          (memberIds as string[])
            .filter((memberId) => memberId && memberId !== S.me)
            .forEach((memberId) => seenReactionKeys.current.add(`${itemId}|${emoji}|${memberId}`));
        });

        (item.witnesses ?? [])
          .filter((memberId: string) => memberId && memberId !== S.me)
          .forEach((memberId: string) => seenWitnessKeys.current.add(`${itemId}|${memberId}`));
      }
    }

    function handleInsert(item: any) {
      const itemId = String(item.id || '');
      const parsedComment = parseFeedCommentAction(item.action);

      if (parsedComment?.targetKey === S.me && itemId && !seenCommentIds.current.has(itemId)) {
        seenCommentIds.current.add(itemId);

        const dedupeKey = `comment:${itemId}`;
        if (!hasNotification(NOTIF_TYPES.FEED_COMMENT, dedupeKey)) {
          addNotification({
            type: NOTIF_TYPES.FEED_COMMENT,
            title: `${getFeedMemberName(item.who)} kommenterade din aktivitet`,
            body: parsedComment.comment,
            memberKey: S.me!,
            ts: Date.now(),
            payload: {
              dedupeKey,
              memberId: item.who,
              comment: parsedComment.comment,
              contextLabel: parsedComment.contextLabel,
              feedEventId: itemId,
            },
          });
        }
      }
    }

    function handleUpdate(item: any) {
      if (item.who !== S.me) return;
      const itemId = String(item.id || '');
      if (!itemId) return;

      Object.entries(item.reactions ?? {}).forEach(([emoji, memberIds]) => {
        (memberIds as string[])
          .filter((memberId) => memberId && memberId !== S.me)
          .forEach((memberId) => {
            const key = `${itemId}|${emoji}|${memberId}`;
            if (seenReactionKeys.current.has(key)) return;
            seenReactionKeys.current.add(key);

            const dedupeKey = `reaction:${key}`;
            if (!hasNotification(NOTIF_TYPES.FEED_REACTION, dedupeKey)) {
              addNotification({
                type: NOTIF_TYPES.FEED_REACTION,
                title: `${getFeedMemberName(memberId)} reagerade på din aktivitet`,
                body: `${emoji} på ${getFeedContextLabel(item)}`,
                memberKey: S.me!,
                ts: Date.now(),
                payload: {
                  dedupeKey,
                  memberId,
                  emoji,
                  contextLabel: getFeedContextLabel(item),
                  feedItemId: itemId,
                },
              });
            }
          });
      });

      (item.witnesses ?? [])
        .filter((memberId: string) => memberId && memberId !== S.me)
        .forEach((memberId: string) => {
          const key = `${itemId}|${memberId}`;
          if (seenWitnessKeys.current.has(key)) return;
          seenWitnessKeys.current.add(key);

          const dedupeKey = `witness:${key}`;
          if (!hasNotification(NOTIF_TYPES.FEED_WITNESS, dedupeKey)) {
            addNotification({
              type: NOTIF_TYPES.FEED_WITNESS,
              title: `${getFeedMemberName(memberId)} såg din aktivitet`,
              body: `På ${getFeedContextLabel(item)}`,
              memberKey: S.me!,
              ts: Date.now(),
              payload: {
                dedupeKey,
                memberId,
                contextLabel: getFeedContextLabel(item),
                feedItemId: itemId,
              },
            });
          }
        });
    }

    async function seed() {
      const { data } = await supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      (data || []).forEach(seedItem);
      initialized.current = true;
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
