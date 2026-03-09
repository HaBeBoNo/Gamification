const listeners = new Set();
let notifications = [];

export function getUnreadCount() {
  return notifications.filter(n => !n.read).length;
}

export function subscribeNotifications(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
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
