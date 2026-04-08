export type ReengagementStage = 'active' | 'quiet_3' | 'quiet_7' | 'quiet_14';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getActivityAnchorTs(lastSeen?: number, lastQuestDate?: number): number {
  return Math.max(Number(lastSeen || 0), Number(lastQuestDate || 0), 0);
}

export function getDaysSinceActivity(lastSeen?: number, lastQuestDate?: number, now = Date.now()): number {
  const anchor = getActivityAnchorTs(lastSeen, lastQuestDate);
  if (!anchor) return 0;
  return Math.max(0, Math.floor((now - anchor) / DAY_MS));
}

export function getReengagementStage(daysSinceActivity: number): ReengagementStage {
  if (daysSinceActivity >= 14) return 'quiet_14';
  if (daysSinceActivity >= 7) return 'quiet_7';
  if (daysSinceActivity >= 3) return 'quiet_3';
  return 'active';
}

export function isCalendarResponseNeeded(
  eventStart: string,
  hasResponded: boolean,
  now = Date.now()
): boolean {
  if (!eventStart || hasResponded) return false;
  const eventTs = new Date(eventStart).getTime();
  if (!Number.isFinite(eventTs)) return false;
  const diff = eventTs - now;
  return diff >= 0 && diff <= 7 * DAY_MS;
}
