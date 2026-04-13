import { MEMBER_IDS } from '@/data/members';
import { createRemoteNotifications } from '@/lib/socialData';
import { sendPush } from '@/lib/sendPush';

const PUSH_SIGNAL_TYPES = new Set([
  'feed_comment',
  'feed_reaction',
  'feed_witness',
  'collaborative_invite',
  'collaborative_join',
  'collaborative_progress',
  'collaborative_complete',
  'high_five',
  'calendar_rsvp',
  'calendar_decline',
  'calendar_check_in',
  'delegation_received',
  'delegation_accepted',
  'delegation_declined',
]);

export function getBandmateKeys(memberKey?: string | null): string[] {
  return MEMBER_IDS.filter((candidate) => candidate !== memberKey);
}

export async function notifyMembersSignal(params: {
  targetMemberKeys: string[];
  type: string;
  title: string;
  body?: string;
  dedupeKey: string;
  payload?: Record<string, unknown>;
  skipRemoteNotification?: boolean;
  feedItemId?: string | null;
  push?: {
    title: string;
    body: string;
    excludeMember?: string;
    url?: string;
  };
}): Promise<void> {
  const targetMemberKeys = [...new Set((params.targetMemberKeys || []).filter(Boolean))];
  if (targetMemberKeys.length === 0) return;

  if (!params.skipRemoteNotification) {
    try {
      await createRemoteNotifications({
        targetMemberKeys,
        type: params.type,
        title: params.title,
        body: params.body,
        dedupeKey: params.dedupeKey,
        feedItemId: params.feedItemId || null,
        payload: params.payload,
      });
    } catch (error: any) {
      console.warn('notifyMembersSignal failed:', error?.message || error);
    }
  }

  if (params.push && PUSH_SIGNAL_TYPES.has(params.type)) {
    await sendPush(
      params.push.title,
      params.push.body,
      {
        excludeMember: params.push.excludeMember,
        targetMemberKeys,
        url: params.push.url || '/',
      }
    );
  }
}
