// ═══════════════════════════════════════════════════════════════
// notifications.ts — Notifikationsslice för Sektionen
//
// Backing store: Zustand (useGameStore.notifications[])
//
// Publik API (oförändrat — alla konsumenter fortsätter fungera):
//   addNotification(notification)
//   addNotifToAll(notif)
//   markAllRead()
//   markRead(id)
//   getNotifications()    → läser direkt ur Zustand getState()
//   getUnreadCount()      → läser direkt ur Zustand getState()
//   subscribeNotifications(fn)  → tunn wrapper runt Zustand subscribe
//
// Komponenter som vill reagera reaktivt bör använda Zustand-selector:
//   useGameStore(s => s.notifications.filter(n => !n.read).length)
//   useGameStore(s => s.notifications)
// ═══════════════════════════════════════════════════════════════

import { S, save, useGameStore } from './store';
import type { Notification } from '../types/game';
import { markRemoteNotificationsRead } from '@/lib/socialData';

export type { Notification };

// ── Notification type identifiers ────────────────────────────────

export const notificationTypes = {
  DELEGATION_RECEIVED:  'delegation_received',
  DELEGATION_ACCEPTED:  'delegation_accepted',
  DELEGATION_DECLINED:  'delegation_declined',
  SYNERGY_TRIGGERED:    'synergy_triggered',
  BADGE_UNLOCKED:       'badge_unlocked',
  GOAL_MILESTONE:       'goal_milestone',
  QUEST_COMPLETED:      'quest_completed',
} as const;

export const NOTIF_TYPES = {
  LEVEL_UP:               'level_up',
  HIGH_FIVE:              'high_five',
  COLLABORATIVE_INVITE:   'collaborative_invite',
  COLLABORATIVE_PROGRESS: 'collaborative_progress',
  COLLABORATIVE_COMPLETE: 'collaborative_complete',
  QUEST_COMPLETE:         'quest_complete',
  CALENDAR_RSVP:          'calendar_rsvp',
  CALENDAR_CHECK_IN:      'calendar_check_in',
  FIRST_LOGIN:            'first_login',
  STREAK:                 'streak',
  FEED_COMMENT:           'feed_comment',
  FEED_REACTION:          'feed_reaction',
  FEED_WITNESS:           'feed_witness',
} as const;

function notificationIdentity(notification: Notification): string {
  const dedupeKey = notification.payload?.dedupeKey;
  if (typeof dedupeKey === 'string' && dedupeKey) {
    return `dedupe:${notification.type}:${notification.memberKey || ''}:${dedupeKey}`;
  }

  if (notification.source === 'supabase' && notification.remoteId) {
    return `remote:${notification.remoteId}`;
  }

  return `local:${String(notification.id)}`;
}

function sortAndTrimNotifications(notifications: Notification[]): Notification[] {
  const deduped = new Map<string, Notification>();

  [...notifications]
    .sort((a, b) => b.ts - a.ts)
    .forEach((notification) => {
      const identity = notificationIdentity(notification);
      if (!deduped.has(identity)) {
        deduped.set(identity, notification);
      }
    });

  return [...deduped.values()].sort((a, b) => b.ts - a.ts).slice(0, 50);
}

// ── Factory-funktioner ───────────────────────────────────────────

export function createLevelUpNotif(
  memberKey: string, memberName: string, newLevel: number
): Notification {
  return {
    id:        Date.now() + Math.random(),
    type:      NOTIF_TYPES.LEVEL_UP,
    title:     `${memberName} nådde nivå ${newLevel}! ⚡`,
    body:      `Grattis ${memberName} — fortsätt så!`,
    memberKey,
    ts:        Date.now(),
    read:      false,
  };
}

export function createHighFiveNotif(
  fromKey: string, fromName: string, toKey: string, toName: string
): Notification {
  return {
    id:        Date.now() + Math.random(),
    type:      NOTIF_TYPES.HIGH_FIVE,
    title:     `${fromName} gav ${toName} en high-five 🙌`,
    body:      '',
    memberKey: toKey,
    ts:        Date.now(),
    read:      false,
  };
}

export function createFirstLoginNotif(memberKey: string, memberName: string): Notification {
  return {
    id:        Date.now() + Math.random(),
    type:      NOTIF_TYPES.FIRST_LOGIN,
    title:     `${memberName} har anslutit sig till Headquarters! 🎉`,
    body:      'Välkommen till bandet.',
    memberKey,
    ts:        Date.now(),
    read:      false,
  };
}

export function createStreakNotif(
  memberKey: string, memberName: string, streakDays: number
): Notification {
  return {
    id:        Date.now() + Math.random(),
    type:      NOTIF_TYPES.STREAK,
    title:     `${memberName} har ${streakDays} dagars streak! 🔥`,
    body:      `${streakDays} dagar i rad — håll i det.`,
    memberKey,
    ts:        Date.now(),
    read:      false,
  };
}

// ── Publik API — backed by Zustand ───────────────────────────────

/** Läser notifikationer direkt från Zustand state (ingen hook behövs). */
export function getNotifications(): Notification[] {
  return useGameStore.getState().notifications;
}

/** Räknar olästa — synkront ur Zustand state. */
export function getUnreadCount(): number {
  return useGameStore.getState().notifications.filter(n => !n.read).length;
}

/** Lägger till en ny notifikation längst fram. */
export function addNotification(notification: Omit<Notification, 'id' | 'read'>): void {
  const notif: Notification = {
    ...notification,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    read: false,
    source: notification.source || 'local',
  };
  useGameStore.setState(s => ({
    notifications: sortAndTrimNotifications([notif, ...s.notifications]),
  }));
  save();
}

/** Lägger till ett redan format notif-objekt (med id + ts) och trunkerar till 50. */
export function addNotifToAll(notif: Notification): void {
  useGameStore.setState(s => ({
    notifications: sortAndTrimNotifications([{ ...notif, source: notif.source || 'local' }, ...s.notifications]),
  }));
  save();
}

/**
 * addNotifToMembers(notif, memberKeys)
 * Lägger till ett notifikationsobjekt riktat till en lista av specifika members.
 * Skapar ett unikt id och ts per mottagare. Stöder extra fält (t.ex. questId) via cast.
 */
export function addNotifToMembers(
  notif: Omit<Notification, 'id' | 'read' | 'ts'> & { questId?: number; [key: string]: any },
  memberKeys: string[]
): void {
  memberKeys.forEach(memberKey => {
    const fullNotif: Notification = {
      ...notif,
      id:        `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      memberKey,
      ts:        Date.now(),
      read:      false,
      source:    notif.source || 'local',
    };
    useGameStore.setState(s => ({
      notifications: sortAndTrimNotifications([fullNotif, ...s.notifications]),
    }));
  });
  save();
}

export function upsertNotifications(notifications: Notification[]): void {
  if (notifications.length === 0) return;

  useGameStore.setState((state) => ({
    notifications: sortAndTrimNotifications([
      ...notifications.map((notification) => ({
        ...notification,
        source: notification.source || 'supabase',
      })),
      ...state.notifications,
    ]),
  }));
  save();
}

/** Markerar alla notifikationer som lästa. */
export function markAllRead(): void {
  const currentNotifications = useGameStore.getState().notifications;
  const remoteIds = currentNotifications
    .filter((notification) => !notification.read && notification.source === 'supabase')
    .map((notification) => notification.remoteId || String(notification.id));

  useGameStore.setState(s => ({
    notifications: s.notifications.map(n => ({ ...n, read: true })),
  }));
  save();

  if (S.me && remoteIds.length > 0) {
    void markRemoteNotificationsRead(S.me, remoteIds);
  }
}

/** Markerar en enskild notifikation som läst. */
export function markRead(id: string | number): void {
  const currentNotifications = useGameStore.getState().notifications;
  const notification = currentNotifications.find((item) => item.id === id);

  useGameStore.setState(s => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
  }));
  save();

  if (S.me && notification?.source === 'supabase') {
    void markRemoteNotificationsRead(S.me, [notification.remoteId || String(notification.id)]);
  }
}

/**
 * subscribeNotifications(fn) — bakåtkompatibel prenumeration.
 * Returnerar en unsubscribe-funktion (precis som tidigare).
 *
 * Föredra Zustand-selectorer i nya komponenter:
 *   useGameStore(s => s.notifications)
 */
export function subscribeNotifications(fn: (notifications: Notification[]) => void): () => void {
  return useGameStore.subscribe(state => {
    fn(state.notifications);
  });
}
