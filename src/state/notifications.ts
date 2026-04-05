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

import { save, useGameStore } from './store';
import type { Notification } from '../types/game';

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
  COLLABORATIVE_COMPLETE: 'collaborative_complete',
  QUEST_COMPLETE:         'quest_complete',
  FIRST_LOGIN:            'first_login',
  STREAK:                 'streak',
  FEED_COMMENT:           'feed_comment',
  FEED_REACTION:          'feed_reaction',
  FEED_WITNESS:           'feed_witness',
} as const;

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
  const notif: Notification = { ...notification, id: Date.now() + Math.random(), read: false };
  useGameStore.setState(s => ({
    notifications: [notif, ...s.notifications].slice(0, 50),
  }));
  save();
}

/** Lägger till ett redan format notif-objekt (med id + ts) och trunkerar till 50. */
export function addNotifToAll(notif: Notification): void {
  useGameStore.setState(s => ({
    notifications: [notif, ...s.notifications].slice(0, 50),
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
      id:        Date.now() + Math.random(),
      memberKey,
      ts:        Date.now(),
      read:      false,
    };
    useGameStore.setState(s => ({
      notifications: [fullNotif, ...s.notifications].slice(0, 50),
    }));
  });
  save();
}

/** Markerar alla notifikationer som lästa. */
export function markAllRead(): void {
  useGameStore.setState(s => ({
    notifications: s.notifications.map(n => ({ ...n, read: true })),
  }));
  save();
}

/** Markerar en enskild notifikation som läst. */
export function markRead(id: number): void {
  useGameStore.setState(s => ({
    notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
  }));
  save();
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
