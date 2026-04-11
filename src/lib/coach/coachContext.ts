import { MEMBERS } from '@/data/members';
import { DEFAULT_COACH_NAMES } from '@/lib/coach/coachPrompts';
import { getDaysSinceActivity, getReengagementStage, type ReengagementStage } from '@/lib/reengagement';
import { isQuestDoneNow } from '@/lib/questUtils';
import { S, useGameStore } from '@/state/store';
import type { CharData, FeedEntry, Notification, Quest, ResponseProfile } from '@/types/game';
import type { Member } from '@/data/members';

const DAY_MS = 24 * 60 * 60 * 1000;
const BAND_WINDOW_MS = 7 * DAY_MS;
const ACTIVE_NOW_WINDOW_MS = 5 * 60 * 1000;
const LIVE_EVENT_LOOKBACK_MS = 3 * 60 * 60 * 1000;

export interface CoachBandEvent {
  id: string;
  title: string;
  start: string;
  source: 'reminder' | 'check_in';
}

export interface CoachBandActivityWindow {
  feed: FeedEntry[];
  notifications: Notification[];
  activeMemberKeys: string[];
  feedCount: number;
  notificationCount: number;
}

export interface CoachInsightSummary {
  title: string;
  insight: string;
}

export interface CoachContext {
  now: number;
  memberKey: string;
  memberName: string;
  member: Member | null;
  char: CharData;
  coachName: string;
  streak: number;
  daysSinceActivity: number;
  reengagementStage: ReengagementStage;
  activeQuests: Quest[];
  nextQuest: Quest | null;
  openQuestCount: number;
  latestMemberActivity: FeedEntry | null;
  latestBandActivity: FeedEntry | null;
  bandActivity7d: CoachBandActivityWindow;
  nextBandEvent: CoachBandEvent | null;
  activeMemberKeysNow: string[];
  otherActiveMemberKeys: string[];
  notifications: Notification[];
  unreadNotifications: Notification[];
  recentInsights: CoachInsightSummary[];
  deletedQuests: Array<Record<string, unknown>>;
  responseProfile?: ResponseProfile;
  coachLog: Array<{ user?: string; coach?: string; ts: number }>;
}

function parseTimestamp(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getFeedTimestamp(item: Partial<FeedEntry>): number {
  return (
    parseTimestamp(item.created_at) ||
    parseTimestamp(item.ts) ||
    parseTimestamp(item.time) ||
    parseTimestamp(item.t)
  );
}

function getNotificationActorMemberKey(notification: Notification): string | null {
  const payloadActor = notification.payload?.memberId;
  if (typeof payloadActor === 'string' && payloadActor) return payloadActor;

  return null;
}

function getCoachName(memberKey: string, char: CharData): string {
  return String(char.coachName || DEFAULT_COACH_NAMES[memberKey] || 'Coach');
}

function getSortedRecentFeed(feed: FeedEntry[], predicate?: (item: FeedEntry) => boolean): FeedEntry[] {
  const filtered = predicate ? feed.filter(predicate) : [...feed];
  return filtered.sort((left, right) => getFeedTimestamp(right) - getFeedTimestamp(left));
}

function getSortedRecentNotifications(
  notifications: Notification[],
  predicate?: (notification: Notification) => boolean,
): Notification[] {
  const filtered = predicate ? notifications.filter(predicate) : [...notifications];
  return filtered.sort((left, right) => Number(right.ts || 0) - Number(left.ts || 0));
}

function getNextBandEvent(nowTs: number): CoachBandEvent | null {
  const events = [
    ...(S.reminders || []).map((reminder) => ({
      id: reminder.eventId,
      title: reminder.eventTitle,
      start: reminder.eventStart,
      source: 'reminder' as const,
    })),
    ...(S.checkIns || [])
      .filter((entry) => entry?.eventId && entry?.eventTitle && entry?.eventStart)
      .map((entry) => ({
        id: String(entry.eventId || ''),
        title: String(entry.eventTitle || ''),
        start: String(entry.eventStart || ''),
        source: 'check_in' as const,
      })),
  ];

  const deduped = new Map<string, CoachBandEvent>();
  events.forEach((event) => {
    if (!event.id || !event.title || !event.start) return;
    if (!deduped.has(event.id)) deduped.set(event.id, event);
  });

  return [...deduped.values()]
    .filter((event) => {
      const startTs = parseTimestamp(event.start);
      return startTs > 0 && startTs >= nowTs - LIVE_EVENT_LOOKBACK_MS;
    })
    .sort((left, right) => parseTimestamp(left.start) - parseTimestamp(right.start))[0] || null;
}

function getActiveMemberKeysNow(
  memberKey: string,
  feed: FeedEntry[],
  notifications: Notification[],
  nowTs: number,
): string[] {
  const activeMembers = new Set<string>();
  const cutoff = nowTs - ACTIVE_NOW_WINDOW_MS;

  feed.forEach((item) => {
    const ts = getFeedTimestamp(item);
    if (ts < cutoff || !item.who) return;
    activeMembers.add(item.who);
  });

  notifications.forEach((notification) => {
    const ts = Number(notification.ts || 0);
    const actor = getNotificationActorMemberKey(notification);
    if (ts < cutoff || !actor) return;
    activeMembers.add(actor);
  });

  if (
    memberKey === S.me &&
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible'
  ) {
    activeMembers.add(memberKey);
  }

  return [...activeMembers];
}

export function getCoachContext(memberKey: string, nowTs = Date.now()): CoachContext {
  const member = ((MEMBERS as Record<string, Member>)[memberKey] || null) as Member | null;
  const char = (S.chars[memberKey] || {
    id: memberKey,
    level: 1,
    xp: 0,
    xpToNext: 100,
    totalXp: 0,
    questsDone: 0,
    streak: 0,
    lastSeen: 0,
    categoryCount: {},
    stats: { vit: 10, wis: 10, for: 10, cha: 10 },
    motivation: '',
    roleEnjoy: '',
    roleDrain: '',
    hiddenValue: '',
    gap: '',
    roleType: member?.roleType || 'amplifier',
    pts: { work: 0, spotify: 0, social: 0, bonus: 0 },
    form: [],
  }) as CharData;

  const feed = useGameStore.getState().feed || [];
  const notifications = useGameStore.getState().notifications || [];
  const activeQuests = (S.quests || []).filter(
    (quest) => quest.owner === memberKey && !isQuestDoneNow(quest)
  );
  const sinceWindowTs = nowTs - BAND_WINDOW_MS;
  const bandRecentFeed = getSortedRecentFeed(
    feed,
    (item) => getFeedTimestamp(item) >= sinceWindowTs,
  );
  const bandRecentNotifications = getSortedRecentNotifications(
    notifications,
    (notification) => Number(notification.ts || 0) >= sinceWindowTs,
  );
  const bandActivityMembers = new Set<string>();

  bandRecentFeed.forEach((item) => {
    if (item.who) bandActivityMembers.add(item.who);
  });
  bandRecentNotifications.forEach((notification) => {
    const actor = getNotificationActorMemberKey(notification);
    if (actor) bandActivityMembers.add(actor);
  });

  const latestMemberActivity = getSortedRecentFeed(feed, (item) => item.who === memberKey)[0] || null;
  const latestBandActivity = getSortedRecentFeed(
    feed,
    (item) => Boolean(item.who) && item.who !== memberKey,
  )[0] || null;
  const daysSinceActivity = getDaysSinceActivity(char.lastSeen, char.lastQuestDate, nowTs);
  const activeMemberKeysNow = getActiveMemberKeysNow(memberKey, feed, notifications, nowTs);
  const recentInsights = (S.quests || [])
    .filter((quest) => quest.owner === memberKey && quest.insight)
    .slice(-5)
    .map((quest) => ({
      title: quest.title,
      insight: String(quest.insight || ''),
    }));
  const deletedQuests = Array.isArray(char.deletedQuests)
    ? (char.deletedQuests as Array<Record<string, unknown>>).slice(-5)
    : [];

  return {
    now: nowTs,
    memberKey,
    memberName: member?.name || memberKey,
    member,
    char,
    coachName: getCoachName(memberKey, char),
    streak: Number(char.streak || 0),
    daysSinceActivity,
    reengagementStage: getReengagementStage(daysSinceActivity),
    activeQuests,
    nextQuest: activeQuests[0] || null,
    openQuestCount: activeQuests.length,
    latestMemberActivity,
    latestBandActivity,
    bandActivity7d: {
      feed: bandRecentFeed,
      notifications: bandRecentNotifications,
      activeMemberKeys: [...bandActivityMembers],
      feedCount: bandRecentFeed.length,
      notificationCount: bandRecentNotifications.length,
    },
    nextBandEvent: getNextBandEvent(nowTs),
    activeMemberKeysNow,
    otherActiveMemberKeys: activeMemberKeysNow.filter((activeKey) => activeKey !== memberKey),
    notifications,
    unreadNotifications: notifications.filter((notification) => !notification.read),
    recentInsights,
    deletedQuests,
    responseProfile: char.responseProfile as ResponseProfile | undefined,
    coachLog: (char.coachLog || []).slice(-10),
  };
}
