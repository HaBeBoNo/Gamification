import { MEMBERS } from '@/data/members';
import type { Notification } from '@/types/game';
import type { FeedIntent } from '@/lib/feedIntent';

export type NotificationTarget = 'activity' | 'quests' | 'coach' | 'profile' | 'bandhub' | 'notifications';

function memberNameFromPayload(notification: Notification): string {
  const memberId = notification.payload?.memberId as string | undefined;
  return memberId
    ? (MEMBERS as Record<string, { name?: string }>)[memberId]?.name || memberId
    : '';
}

const str = (value: unknown): string => (value as string) || '';

export function getNotificationText(notification: Notification): { title: string; subtitle: string } {
  const p = notification.payload || {};
  const memberName = memberNameFromPayload(notification);

  switch (notification.type) {
    case 'delegation_received':
      return { title: `${memberName} skickade dig ett uppdrag`, subtitle: str(p.questTitle) };
    case 'delegation_accepted':
      return { title: `${memberName} accepterade ditt uppdrag`, subtitle: str(p.questTitle) };
    case 'delegation_declined':
      return { title: `${memberName} tackade nej till ditt uppdrag`, subtitle: str(p.questTitle) };
    case 'synergy_triggered':
      return { title: 'Synergi aktiverad', subtitle: `${str(p.questTitle)} upplåst` };
    case 'badge_unlocked':
      return { title: `Nytt märke: ${str(p.badgeName)}`, subtitle: str(p.desc) };
    case 'goal_milestone':
      return { title: `Bandet passerade ${str(p.milestoneName)}!`, subtitle: '' };
    case 'quest_completed':
      return { title: `${memberName} klarade ${str(p.questTitle)}`, subtitle: '' };
    case 'first_login':
      return {
        title: notification.title || `${memberName || 'Någon'} anslöt sig till HQ`,
        subtitle: notification.body || '',
      };
    case 'streak':
      return {
        title: notification.title || `${memberName || 'Någon'} håller en streak`,
        subtitle: notification.body || '',
      };
    case 'level_up':
      return { title: notification.title || 'Level up!', subtitle: notification.body || '' };
    case 'high_five':
      return { title: notification.title || 'High five!', subtitle: notification.body || '' };
    case 'collaborative_complete':
      return { title: notification.title || 'Kollaborativt uppdrag klart', subtitle: notification.body || '' };
    case 'quest_complete':
      return { title: notification.title || 'Uppdrag slutfört', subtitle: notification.body || '' };
    case 'feed_comment':
      return {
        title: notification.title || `${memberName || 'Någon'} kommenterade din aktivitet`,
        subtitle: notification.body || '',
      };
    case 'feed_reaction':
      return {
        title: notification.title || `${memberName || 'Någon'} reagerade på din aktivitet`,
        subtitle: notification.body || '',
      };
    case 'feed_witness':
      return {
        title: notification.title || `${memberName || 'Någon'} såg din aktivitet`,
        subtitle: notification.body || '',
      };
    case 'calendar_rsvp':
      return {
        title: notification.title || `${memberName || 'Någon'} kommer`,
        subtitle: notification.body || '',
      };
    case 'calendar_check_in':
      return {
        title: notification.title || `${memberName || 'Någon'} checkade in`,
        subtitle: notification.body || '',
      };
    default:
      return { title: notification.title || 'Notifikation', subtitle: notification.body || '' };
  }
}

export function getNotificationTarget(notification: Notification): NotificationTarget {
  switch (notification.type) {
    case 'feed_comment':
    case 'feed_reaction':
    case 'feed_witness':
    case 'high_five':
    case 'first_login':
      return 'activity';
    case 'delegation_received':
    case 'delegation_accepted':
    case 'delegation_declined':
    case 'collaborative_complete':
    case 'quest_complete':
    case 'quest_completed':
    case 'synergy_triggered':
      return 'quests';
    case 'level_up':
    case 'badge_unlocked':
    case 'streak':
      return 'profile';
    case 'goal_milestone':
      return 'activity';
    case 'calendar_rsvp':
    case 'calendar_check_in':
      return 'bandhub';
    default:
      return 'notifications';
  }
}

export function getNotificationActionLabel(notification: Notification): string {
  switch (getNotificationTarget(notification)) {
    case 'activity':
      return notification.type === 'feed_comment' ? 'Svara' : 'Se aktivitet';
    case 'quests':
      return 'Öppna uppdrag';
    case 'profile':
      return 'Visa profil';
    case 'bandhub':
      return 'Öppna kalender';
    case 'coach':
      return 'Öppna coach';
    default:
      return 'Visa alla';
  }
}

export function getNotificationPriority(notification: Notification): number {
  switch (notification.type) {
    case 'feed_comment':
      return 100;
    case 'delegation_received':
      return 95;
    case 'collaborative_complete':
      return 90;
    case 'feed_reaction':
      return 80;
    case 'calendar_rsvp':
      return 88;
    case 'calendar_check_in':
      return 86;
    case 'feed_witness':
      return 70;
    default:
      return 50;
  }
}

export function getNotificationFeedIntent(notification: Notification): Omit<FeedIntent, 'id' | 'createdAt'> | null {
  switch (notification.type) {
    case 'feed_comment':
      return {
        mode: 'reply',
        feedItemId: notification.payload?.parentFeedItemId as string | undefined,
        ownerKey: notification.memberKey,
        contextLabel: notification.payload?.contextLabel as string | undefined,
        draft: memberNameFromPayload(notification)
          ? `@${memberNameFromPayload(notification).split(' ')[0]} `
          : undefined,
        replyTarget: memberNameFromPayload(notification)
          ? {
              memberKey: notification.payload?.memberId as string | undefined,
              memberName: memberNameFromPayload(notification),
              commentId: notification.payload?.feedEventId as string | undefined,
            }
          : undefined,
      };
    case 'feed_reaction':
    case 'feed_witness':
      return {
        mode: notification.type === 'feed_reaction' ? 'reply' : 'focus',
        feedItemId: notification.payload?.feedItemId as string | undefined,
      };
    default:
      return null;
  }
}
