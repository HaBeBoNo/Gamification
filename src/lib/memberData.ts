import { S } from '@/state/store';
import type { Notification, Reminder } from '@/types/game';
import {
  getOwnCalendarCheckIns,
  mergeCalendarCheckInSources,
  type CalendarCheckInEntry,
} from '@/lib/calendarState';

export const MEMBER_DATA_PAYLOAD_KEYS = [
  'chars',
  'quests',
  'metrics',
  'prev',
  'checkIns',
  'reminders',
  'onboarded',
  'operationName',
  'weeklyCheckouts',
  'notifications',
  'seasonStart',
  'seasonEnd',
] as const;

export type MemberDataPayload = {
  chars: Record<string, unknown>;
  quests: unknown[];
  metrics: unknown;
  prev: unknown;
  checkIns: CalendarCheckInEntry[];
  reminders: Reminder[];
  onboarded: boolean;
  operationName: string;
  weeklyCheckouts: Record<string, unknown>;
  notifications: Notification[];
  seasonStart: string;
  seasonEnd: string;
};

export function mergeReminders(
  localReminders: Reminder[] = [],
  remoteReminders: Reminder[] = []
): Reminder[] {
  const merged = new Map<string, Reminder>();

  [...remoteReminders, ...localReminders].forEach((reminder) => {
    if (!reminder?.eventId || !reminder?.memberKey) return;
    merged.set(`${reminder.memberKey}:${reminder.eventId}`, reminder);
  });

  return [...merged.values()].sort((a, b) => (a.eventStart || '').localeCompare(b.eventStart || ''));
}

export function buildMemberDataPayload(
  memberKey: string,
  notifications: Notification[]
): MemberDataPayload {
  return {
    chars: { [memberKey]: S.chars[memberKey] },
    quests: S.quests,
    metrics: S.metrics,
    prev: S.prev,
    checkIns: getOwnCalendarCheckIns(S.checkIns, memberKey),
    reminders: S.reminders,
    onboarded: S.onboarded,
    operationName: S.operationName,
    weeklyCheckouts: S.weeklyCheckouts,
    notifications: notifications.filter((notification) => notification.source !== 'supabase'),
    seasonStart: S.seasonStart,
    seasonEnd: S.seasonEnd,
  };
}

export function mergeMemberCheckIns(
  ownMemberKey: string,
  ownEntries: readonly unknown[] | null | undefined,
  otherRows: Array<{ member_key?: string; data?: { checkIns?: readonly unknown[] | null } }>
): CalendarCheckInEntry[] {
  return mergeCalendarCheckInSources([
    { entries: ownEntries, fallbackMemberKey: ownMemberKey },
    ...otherRows.map((row) => ({
      entries: row?.data?.checkIns,
      fallbackMemberKey: row?.member_key,
    })),
  ]);
}
