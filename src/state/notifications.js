const listeners = new Set();
let notifications = [];

export function getUnreadCount() {
  return notifications.filter(n => !n.read).length;
}

export function subscribeNotifications(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function addNotification(notification) {
  notifications = [{ ...notification, id: Date.now(), read: false }, ...notifications];
  listeners.forEach(fn => fn(notifications));
}

export function markAllRead() {
  notifications = notifications.map(n => ({ ...n, read: true }));
  listeners.forEach(fn => fn(notifications));
}

export function markRead(id) {
  notifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
  listeners.forEach(fn => fn(notifications));
}

export function getNotifications() {
  return notifications;
}

// Notification type identifiers (used for icon/color mapping in NotificationPanel)
export const notificationTypes = {
  DELEGATION_RECEIVED:  'delegation_received',
  DELEGATION_ACCEPTED:  'delegation_accepted',
  DELEGATION_DECLINED:  'delegation_declined',
  SYNERGY_TRIGGERED:    'synergy_triggered',
  BADGE_UNLOCKED:       'badge_unlocked',
  GOAL_MILESTONE:       'goal_milestone',
  QUEST_COMPLETED:      'quest_completed',
};

export const NOTIF_TYPES = {
  LEVEL_UP:               'level_up',
  HIGH_FIVE:              'high_five',
  COLLABORATIVE_COMPLETE: 'collaborative_complete',
  QUEST_COMPLETE:         'quest_complete',
};

export function createLevelUpNotif(memberKey, memberName, newLevel) {
  return {
    id: Date.now() + Math.random(),
    type: NOTIF_TYPES.LEVEL_UP,
    title: `${memberName} nådde nivå ${newLevel}! ⚡`,
    body: `Grattis ${memberName} — fortsätt så!`,
    memberKey,
    ts: Date.now(),
    read: false,
  };
}

export function createHighFiveNotif(fromKey, fromName, toKey, toName) {
  return {
    id: Date.now() + Math.random(),
    type: NOTIF_TYPES.HIGH_FIVE,
    title: `${fromName} gav ${toName} en high-five 🙌`,
    body: '',
    memberKey: toKey,
    ts: Date.now(),
    read: false,
  };
}

export function addNotifToAll(notif) {
  notifications = [notif, ...notifications];
  if (notifications.length > 50) notifications = notifications.slice(0, 50);
  listeners.forEach(fn => fn(notifications));
}

/**
 * @typedef {{
 *   id: number,
 *   type: string,
 *   ts: number,
 *   read: boolean,
 *   title?: string,
 *   body?: string,
 *   memberKey?: string,
 *   payload?: Record<string, any>
 * }} Notification
 */
