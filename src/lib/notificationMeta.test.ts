import { describe, expect, it } from 'vitest';
import type { Notification } from '@/types/game';
import {
  getNotificationPriority,
  getNotificationTarget,
  getNotificationText,
  sortNotificationsForAttention,
} from './notificationMeta';

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: overrides.id || `notif-${Math.random().toString(36).slice(2, 8)}`,
    type: overrides.type || 'feed_reaction',
    ts: overrides.ts || Date.now(),
    read: overrides.read ?? false,
    title: overrides.title,
    body: overrides.body,
    memberKey: overrides.memberKey,
    payload: overrides.payload,
  };
}

describe('notificationMeta', () => {
  it('treats collaborative invites as quest-directed high-value signals', () => {
    const notification = makeNotification({
      type: 'collaborative_invite',
      payload: {
        memberId: 'niklas',
        questTitle: 'Sätt refrängen tillsammans',
      },
    });

    expect(getNotificationTarget(notification)).toBe('quests');
    expect(getNotificationPriority(notification)).toBe(96);
    expect(getNotificationText(notification)).toMatchObject({
      subtitle: 'Sätt refrängen tillsammans',
    });
  });

  it('routes collaborative joins as a quest signal with strong priority', () => {
    const notification = makeNotification({
      type: 'collaborative_join',
      payload: {
        memberId: 'niklas',
        questTitle: 'Sätt refrängen tillsammans',
      },
    });

    expect(getNotificationTarget(notification)).toBe('quests');
    expect(getNotificationPriority(notification)).toBe(94);
    expect(getNotificationText(notification)).toMatchObject({
      title: 'Niklas anslöt sig',
      subtitle: 'Sätt refrängen tillsammans',
    });
  });

  it('prioritizes collaborative progress above completion summaries', () => {
    expect(getNotificationPriority(makeNotification({ type: 'collaborative_progress' }))).toBeGreaterThan(
      getNotificationPriority(makeNotification({ type: 'collaborative_complete' }))
    );
  });

  it('routes calendar decline signals to bandhub with strong priority', () => {
    const notification = makeNotification({
      type: 'calendar_decline',
      payload: {
        memberId: 'niklas',
      },
      body: 'Rep i studion',
    });

    expect(getNotificationTarget(notification)).toBe('bandhub');
    expect(getNotificationPriority(notification)).toBe(87);
    expect(getNotificationText(notification)).toMatchObject({
      title: 'Niklas kan inte komma',
      subtitle: 'Rep i studion',
    });
  });

  it('treats check-in opening as a strong calendar action signal', () => {
    const notification = makeNotification({
      type: 'calendar_check_in_open',
      body: 'Kvällsrep',
      payload: {
        eventId: 'rep-1',
        eventTitle: 'Kvällsrep',
      },
    });

    expect(getNotificationTarget(notification)).toBe('bandhub');
    expect(getNotificationPriority(notification)).toBe(91);
    expect(getNotificationText(notification)).toMatchObject({
      title: 'Check-in är öppen',
      subtitle: 'Kvällsrep',
    });
  });

  it('sorts unread actionable notifications before read or lower-priority items', () => {
    const sorted = sortNotificationsForAttention([
      makeNotification({ id: 'old-comment', type: 'feed_comment', ts: 10_000, read: false }),
      makeNotification({ id: 'read-invite', type: 'collaborative_invite', ts: 30_000, read: true }),
      makeNotification({ id: 'fresh-reaction', type: 'feed_reaction', ts: 40_000, read: false }),
      makeNotification({ id: 'quest-signal', type: 'collaborative_progress', ts: 20_000, read: false }),
    ]);

    expect(sorted.map((notification) => notification.id)).toEqual([
      'old-comment',
      'quest-signal',
      'fresh-reaction',
      'read-invite',
    ]);
  });
});
