import { MEMBERS } from '@/data/members';
import type { Notification } from '@/types/game';
import type { FeedIntent } from '@/lib/feedIntent';
import type { QueuedBandHubIntent } from '@/lib/navigationIntent';

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
    case 'collaborative_invite':
      return {
        title: notification.title || `${memberName || 'Någon'} bjöd in dig till ett gemensamt uppdrag`,
        subtitle: str(p.questTitle) || notification.body || '',
      };
    case 'collaborative_join':
      return {
        title: notification.title || `${memberName || 'Någon'} anslöt sig`,
        subtitle: str(p.questTitle) || notification.body || '',
      };
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
    case 'collaborative_progress':
      return {
        title: notification.title || `${memberName || 'Någon'} slutförde sin del`,
        subtitle: notification.body || str(p.questTitle) || '',
      };
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
    case 'calendar_decline':
      return {
        title: notification.title || `${memberName || 'Någon'} kan inte komma`,
        subtitle: notification.body || '',
      };
    case 'calendar_check_in':
      return {
        title: notification.title || `${memberName || 'Någon'} checkade in`,
        subtitle: notification.body || '',
      };
    case 'calendar_check_in_open':
      return {
        title: notification.title || 'Check-in är öppen',
        subtitle: notification.body || str(p.eventTitle) || '',
      };
    case 'calendar_reminder':
      return {
        title: notification.title || 'Imorgon',
        subtitle: notification.body || str(p.eventTitle) || '',
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
    case 'collaborative_invite':
    case 'collaborative_join':
    case 'delegation_received':
    case 'delegation_accepted':
    case 'delegation_declined':
    case 'collaborative_progress':
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
    case 'calendar_decline':
    case 'calendar_check_in':
    case 'calendar_check_in_open':
    case 'calendar_reminder':
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

export function getNotificationBandHubIntent(notification: Notification): QueuedBandHubIntent | null {
  if (getNotificationTarget(notification) !== 'bandhub') return null;

  const eventId = notification.payload?.eventId;
  return {
    tab: 'kalender',
    eventId: typeof eventId === 'string' && eventId ? eventId : undefined,
    source: `notification:${notification.type}`,
  };
}

export function getNotificationPriority(notification: Notification): number {
  switch (notification.type) {
    case 'feed_comment':
      return 100;
    case 'collaborative_invite':
      return 96;
    case 'collaborative_join':
      return 94;
    case 'delegation_received':
      return 95;
    case 'collaborative_progress':
      return 92;
    case 'collaborative_complete':
      return 90;
    case 'feed_reaction':
      return 80;
    case 'calendar_rsvp':
      return 88;
    case 'calendar_decline':
      return 87;
    case 'calendar_check_in':
      return 86;
    case 'calendar_check_in_open':
      return 91;
    case 'calendar_reminder':
      return 84;
    case 'feed_witness':
      return 70;
    default:
      return 50;
  }
}

export function sortNotificationsForAttention(notifications: Notification[]): Notification[] {
  return [...notifications].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;

    const priorityDelta = getNotificationPriority(b) - getNotificationPriority(a);
    if (priorityDelta !== 0) return priorityDelta;

    return b.ts - a.ts;
  });
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
