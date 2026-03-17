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

/**
 * @typedef {{
 *   id: number,
 *   type: string,
 *   ts: number,
 *   read: boolean,
 *   payload?: Record<string, any>
 * }} Notification
 */
