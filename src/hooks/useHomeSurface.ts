import { useEffect, useMemo, useState } from 'react';
import { S, useGameStore } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { supabase } from '@/lib/supabase';
import { getUpcomingEvents, isEventActive, isEventSoon, type CalendarEvent } from '@/lib/googleCalendar';
import { isQuestDoneNow } from '@/lib/questUtils';
import { getDailyCoachMessage } from '@/hooks/useAI';
import { fetchMyCollaborativeQuests, type CollaborativeQuest } from '@/lib/collaborativeQuests';
import { fetchSharedBandActivitySnapshot } from '@/lib/socialData';
import {
  getNotificationActionLabel,
  getNotificationTarget,
  getNotificationText,
  sortNotificationsForAttention,
} from '@/lib/notificationMeta';
import { getQuestFocusReason, getRelevantActiveQuests } from '@/lib/questFocus';
import { getDaysSinceActivity, getReengagementStage, isCalendarResponseNeeded } from '@/lib/reengagement';
import { getCalendarEventParticipationState } from '@/lib/calendarState';
import { getFeedCommentMeta } from '@/lib/feed';
import {
  cacheCurrentHomeAttentionSignals,
  filterSeenHomeAttentionSignals,
} from '@/lib/homeAttentionState';
import {
  loadCachedReengagementPlan,
  loadCachedWaitingSignals,
  saveCachedReengagementPlan,
  saveCachedWaitingSignals,
} from '@/lib/homeSurfaceCache';
import {
  buildHomeBandStatusCards,
  formatActivityAge,
  getActivityTimestamp,
  getHomeEchoSummary,
  getMemberName,
  getReengagementContext,
  getReengagementEyebrow,
  getRelativeCalendarLabel,
  isRecentActivity,
  type HomeAttentionSignal,
  type HomeReengagementPlan,
  type HomeRankSummary,
} from '@/lib/homeSurface';

const HOME_SURFACE_CACHE_TTL_MS = 20_000;

const sharedUpcomingEventsCache = new Map<number, {
  expiresAt: number;
  value?: CalendarEvent[];
  promise?: Promise<CalendarEvent[]>;
}>();

const sharedCollaborativeCache = new Map<string, {
  expiresAt: number;
  value?: CollaborativeQuest[];
  promise?: Promise<CollaborativeQuest[]>;
}>();

const reengagementPlanCache = new Map<string, HomeReengagementPlan | null>();
const waitingSignalCache = new Map<string, HomeAttentionSignal[]>();

function readCachedCoachMessage(memberKey: string | null | undefined): string {
  if (!memberKey) return '';
  const char = (S.chars as Record<string, any>)?.[memberKey];
  return typeof char?.dailyCoachMessage === 'string' ? char.dailyCoachMessage : '';
}

function getCachedReengagementPlan(memberKey: string): {
  hasEntry: boolean;
  value: HomeReengagementPlan | null;
} {
  if (reengagementPlanCache.has(memberKey)) {
    return {
      hasEntry: true,
      value: reengagementPlanCache.get(memberKey) ?? null,
    };
  }

  const cached = loadCachedReengagementPlan(memberKey);
  if (cached.hasEntry) {
    reengagementPlanCache.set(memberKey, cached.value);
  }
  return cached;
}

function getCachedWaitingSignals(memberKey: string): {
  hasEntry: boolean;
  value: HomeAttentionSignal[];
} {
  if (waitingSignalCache.has(memberKey)) {
    return {
      hasEntry: true,
      value: waitingSignalCache.get(memberKey) || [],
    };
  }

  const cached = loadCachedWaitingSignals(memberKey);
  if (cached.hasEntry) {
    waitingSignalCache.set(memberKey, cached.value);
  }
  return cached;
}

function getSharedUpcomingEvents(maxResults: number): Promise<CalendarEvent[]> {
  const now = Date.now();
  const cached = sharedUpcomingEventsCache.get(maxResults);
  if (cached?.value && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }
  if (cached?.promise && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = getUpcomingEvents(maxResults)
    .then((events) => {
      sharedUpcomingEventsCache.set(maxResults, {
        value: events,
        expiresAt: Date.now() + HOME_SURFACE_CACHE_TTL_MS,
      });
      return events;
    })
    .catch((error) => {
      sharedUpcomingEventsCache.delete(maxResults);
      throw error;
    });

  sharedUpcomingEventsCache.set(maxResults, {
    promise,
    expiresAt: now + HOME_SURFACE_CACHE_TTL_MS,
  });

  return promise;
}

function getSharedCollaborativeQuests(memberKey: string): Promise<CollaborativeQuest[]> {
  const now = Date.now();
  const cached = sharedCollaborativeCache.get(memberKey);
  if (cached?.value && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }
  if (cached?.promise && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetchMyCollaborativeQuests()
    .then((quests) => {
      sharedCollaborativeCache.set(memberKey, {
        value: quests,
        expiresAt: Date.now() + HOME_SURFACE_CACHE_TTL_MS,
      });
      return quests;
    })
    .catch((error) => {
      sharedCollaborativeCache.delete(memberKey);
      throw error;
    });

  sharedCollaborativeCache.set(memberKey, {
    promise,
    expiresAt: now + HOME_SURFACE_CACHE_TTL_MS,
  });

  return promise;
}

export type HomeAttentionSurfaceState = {
  me: string | null;
  loading: boolean;
  signals: HomeAttentionSignal[];
  unreadCount: number;
};

export function useHomeBandStatusCards(totalMembers: number) {
  const me = S.me;
  const presenceMembers = useGameStore((state) => state.presenceMembers);
  const presenceHydrated = useGameStore((state) => state.presenceHydrated);
  const [activeToday, setActiveToday] = useState(0);
  const [activeNow, setActiveNow] = useState<number | null>(null);
  const [xp48h, setXp48h] = useState(0);
  const [nextEvent, setNextEvent] = useState<{ title: string; date: string } | null>(null);
  const [myRank, setMyRank] = useState<HomeRankSummary | null>(null);

  useEffect(() => {
    async function loadPulse(options?: { forceFresh?: boolean }) {
      try {
        const snapshot = await fetchSharedBandActivitySnapshot(48, 5, options);
        setActiveToday(snapshot.activeToday);
        setXp48h(snapshot.xp48h);
        setActiveNow(snapshot.activeNow);
      } catch {
        // Ignore transient home pulse failures.
      }
    }

    async function loadNextEvent() {
      try {
        const events = await getSharedUpcomingEvents(1);
        const ev = events?.[0];
        if (!ev) return;
        setNextEvent({
          title: ev.title,
          date: getRelativeCalendarLabel(ev.start),
        });
      } catch {
        // Ignore transient event failures.
      }
    }

    async function loadRank() {
      try {
        const { data } = await supabase?.from('member_data').select('member_key, data') || { data: null };
        if (!data) return;
        const sorted = data
          .map((row: any) => ({
            key: row.member_key,
            xp: row.data?.chars?.[row.member_key]?.totalXp ?? row.data?.totalXP ?? 0,
          }))
          .sort((left: any, right: any) => right.xp - left.xp);
        const myPos = sorted.findIndex((row: any) => row.key === me);
        if (myPos < 0) return;
        const above = myPos > 0 ? sorted[myPos - 1] : null;
        const aboveMember = above ? (MEMBERS as Record<string, any>)[above.key] : null;
        setMyRank({
          pos: myPos + 1,
          gap: above ? above.xp - sorted[myPos].xp : 0,
          above: aboveMember?.name ?? above?.key ?? '',
        });
      } catch {
        // Ignore transient rank failures.
      }
    }

    void loadPulse();
    void loadNextEvent();
    void loadRank();

    if (!supabase) return;

    const channel = supabase
      .channel('home-band-status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activity_feed',
      }, () => {
        void loadPulse({ forceFresh: true });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'member_presence',
      }, () => {
        void loadPulse({ forceFresh: true });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // Återskapar Supabase-kanal vid profilbyte (me) så att gammal prenumeration städas
  }, [me]);

  const resolvedActiveNow = presenceHydrated ? presenceMembers.length : activeNow;

  return useMemo(() => buildHomeBandStatusCards({
    totalMembers,
    activeToday,
    activeNow: resolvedActiveNow,
    xp48h,
    nextEvent,
    myRank,
  }), [activeToday, myRank, nextEvent, presenceHydrated, presenceMembers.length, resolvedActiveNow, totalMembers, xp48h]);
}

export function useDailyCoachSurface() {
  const me = S.me;
  const feed = useGameStore((state) => state.feed);
  // tick som proxy-dependency: S.quests muteras in-place, men save() inkrementerar
  // tick — använd tick istället för S.quests-referensen i useMemo-deps.
  const tick = useGameStore((state) => state.tick);
  const [message, setMessage] = useState(() => readCachedCoachMessage(me));
  const [loading, setLoading] = useState(() => Boolean(me) && !readCachedCoachMessage(me));

  useEffect(() => {
    if (!me) {
      setMessage('');
      setLoading(false);
      return;
    }

    const cachedMessage = readCachedCoachMessage(me);
    if (cachedMessage) {
      setMessage(cachedMessage);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let cancelled = false;

    getDailyCoachMessage(me)
      .then((msg) => {
        if (cancelled) return;
        setMessage(msg || cachedMessage);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [me]);

  const coachName = me ? ((S.chars[me] as any)?.coachName || 'Coach') : 'Coach';
  // tick som dep istället för S.quests — S.quests är en mutable referens som aldrig
  // byts ut, men tick inkrementeras vid varje save() som muterar quests.
  const relevantQuests = useMemo(() => (
    me ? getRelevantActiveQuests(S.quests || [], me, 2) : []
  ), [me, tick]);
  const focusQuest = relevantQuests[0];
  const followUpQuest = relevantQuests[1];
  const activeQuestCount = useMemo(() => (
    me ? (S.quests || []).filter((quest: any) => quest.owner === me && !isQuestDoneNow(quest)).length : 0
  ), [me, tick]);
  const latestSocial = useMemo(() => (
    (feed || []).find((item: any) => item.who && item.who !== me) || null
  ), [feed, me]);

  return {
    me,
    loading,
    message,
    coachName,
    focusQuest,
    followUpQuest,
    activeQuestCount,
    latestSocial,
    getQuestFocusReason: me ? (quest: any) => getQuestFocusReason(quest, me) : () => '',
  };
}

export function useReengagementSurface() {
  const me = S.me;
  const notifications = useGameStore((state) => state.notifications);
  const tick = useGameStore((state) => state.tick);
  const reengagementSignature = useMemo(() => {
    if (!me) return '';
    const char = (S.chars as Record<string, any>)?.[me];
    const focusQuest = getRelevantActiveQuests(S.quests || [], me, 1)[0];
    return [
      Number(char?.lastSeen || 0),
      Number(char?.lastQuestDate || 0),
      String(focusQuest?.id ?? ''),
      String(focusQuest?.title ?? ''),
      focusQuest?.done ? '1' : '0',
    ].join('|');
  }, [me, tick]);
  const [loading, setLoading] = useState(() => {
    if (!me) return false;
    const cached = getCachedReengagementPlan(me);
    return !cached.hasEntry;
  });
  const [plan, setPlan] = useState<HomeReengagementPlan | null>(() => (
    me ? getCachedReengagementPlan(me).value : null
  ));

  useEffect(() => {
    if (!me) {
      setPlan(null);
      setLoading(false);
      return;
    }

    const char = (S.chars as Record<string, any>)?.[me];
    const daysSinceActivity = getDaysSinceActivity(char?.lastSeen, char?.lastQuestDate);
    const stage = getReengagementStage(daysSinceActivity);
    const memberKey = me;
    const cachedPlan = getCachedReengagementPlan(memberKey);

    if (cachedPlan.hasEntry) {
      setPlan(cachedPlan.value);
      setLoading(false);
    }

    if (stage === 'active') {
      reengagementPlanCache.set(memberKey, null);
      saveCachedReengagementPlan(memberKey, null);
      setPlan(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPlan() {
      setLoading((current) => current && !cachedPlan.hasEntry);

      const focusQuest = getRelevantActiveQuests(S.quests || [], me || undefined, 1)[0];
      const unreadActionable = sortNotificationsForAttention(notifications)
        .find((notification) => !notification.read && getNotificationTarget(notification) !== 'notifications');

      try {
        const [events, collabs] = await Promise.all([
          getSharedUpcomingEvents(2).catch(() => []),
          getSharedCollaborativeQuests(memberKey).catch(() => []),
        ]);

        const nextEvent = events?.[0] || null;
        const eventLive = nextEvent ? isEventActive(nextEvent.start, nextEvent.end) : false;
        const eventSoon = nextEvent ? isEventSoon(nextEvent.start) : false;
        const participation = nextEvent
          ? getCalendarEventParticipationState(S.checkIns, nextEvent.id, me || undefined)
          : null;
        const eventNeedsResponse = nextEvent
          ? isCalendarResponseNeeded(nextEvent.start, Boolean(participation?.hasResponded))
          : false;

        const collabWaiting = (collabs || []).find((quest: any) =>
          quest?.participants?.includes(me) &&
          !(quest?.completed_by ?? []).includes(me) &&
          (quest?.completed_by ?? []).length > 0
        );

        let nextPlan: HomeReengagementPlan | null = null;

        if (nextEvent && (eventLive || eventNeedsResponse || eventSoon)) {
          nextPlan = {
            eyebrow: getReengagementEyebrow(stage),
            title: eventLive
              ? 'Live nu'
              : eventNeedsResponse
                ? 'Svara i kalendern'
                : 'Nästa uppe',
            subtitle: eventLive
              ? `${nextEvent.title} · ${participation?.checkInCount || 0} incheckad${(participation?.checkInCount || 0) === 1 ? '' : 'e'}`
              : eventNeedsResponse
                ? `${nextEvent.title} · ${getRelativeCalendarLabel(nextEvent.start)}`
                : `${nextEvent.title} · ${getRelativeCalendarLabel(nextEvent.start)}`,
            cta: 'Kalender',
            target: 'bandhub',
          };
        } else if (collabWaiting) {
          nextPlan = {
            eyebrow: getReengagementEyebrow(stage),
            title: 'Din del väntar',
            subtitle: collabWaiting.quest_data?.title || 'Samarbete i rörelse',
            cta: 'Quests',
            target: 'quests',
          };
        } else if (unreadActionable) {
          nextPlan = {
            eyebrow: getReengagementEyebrow(stage),
            title: getNotificationText(unreadActionable).title,
            subtitle: getNotificationText(unreadActionable).subtitle || getReengagementContext(daysSinceActivity, stage),
            cta: getNotificationActionLabel(unreadActionable),
            target: getNotificationTarget(unreadActionable),
          };
        } else if (focusQuest) {
          nextPlan = {
            eyebrow: getReengagementEyebrow(stage),
            title: 'Nästa steg',
            subtitle: focusQuest.title,
            cta: 'Quests',
            target: 'quests',
          };
        } else {
          nextPlan = {
            eyebrow: getReengagementEyebrow(stage),
            title: 'Öppna coach',
            subtitle: getReengagementContext(daysSinceActivity, stage),
            cta: 'Coach',
            target: 'coach',
          };
        }

        if (!cancelled) {
          reengagementPlanCache.set(memberKey, nextPlan);
          saveCachedReengagementPlan(memberKey, nextPlan);
          setPlan(nextPlan);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          const fallbackPlan = {
            eyebrow: getReengagementEyebrow(stage),
            title: 'Öppna coach',
            subtitle: getReengagementContext(daysSinceActivity, stage),
            cta: 'Coach',
            target: 'coach',
          } satisfies HomeReengagementPlan;
          reengagementPlanCache.set(memberKey, fallbackPlan);
          saveCachedReengagementPlan(memberKey, fallbackPlan);
          setPlan(fallbackPlan);
          setLoading(false);
        }
      }
    }

    void loadPlan();

    return () => {
      cancelled = true;
    };
  // Reagera på den del av tick-driven speldata som faktiskt ändrar planen,
  // istället för att rebuilda vid varje save() oavsett relevans.
  }, [me, notifications, reengagementSignature]);

  return { me, loading, plan };
}

export function useWaitingOnYouSurface(enabled = true): HomeAttentionSurfaceState {
  return useWaitingOnYouSurfaceInternal(false, enabled);
}

export function useWaitingOnYouInboxSurface(enabled = true): HomeAttentionSurfaceState {
  return useWaitingOnYouSurfaceInternal(true, enabled);
}

function useWaitingOnYouSurfaceInternal(includeSeen: boolean, enabled: boolean): HomeAttentionSurfaceState {
  const me = S.me;
  const notifications = useGameStore((state) => state.notifications);
  const feed = useGameStore((state) => state.feed);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );
  const tick = useGameStore((state) => state.tick);
  const [signals, setSignals] = useState<HomeAttentionSignal[]>(() => (
    me ? getCachedWaitingSignals(me).value : []
  ));
  const [loading, setLoading] = useState(() => {
    if (!enabled || !me) return false;
    return !getCachedWaitingSignals(me).hasEntry;
  });

  useEffect(() => {
    if (!me) {
      setSignals([]);
      setLoading(false);
      return;
    }

    if (!enabled) {
      setLoading(false);
      return;
    }

    const memberKey = me;
    const cachedSignals = getCachedWaitingSignals(memberKey);
    if (cachedSignals.hasEntry) {
      setSignals(includeSeen ? cachedSignals.value : filterSeenHomeAttentionSignals(memberKey, cachedSignals.value));
      setLoading(false);
    }

    let cancelled = false;

    async function loadSignals() {
      setLoading((current) => current && signals.length === 0 && !cachedSignals.hasEntry);

      const nextSignals: HomeAttentionSignal[] = [];
      const unreadActionable = sortNotificationsForAttention(notifications)
        .filter((notification) => !notification.read)
        .filter((notification) => getNotificationTarget(notification) !== 'notifications')
        .slice(0, 2);

      unreadActionable.forEach((notification) => {
        const { title, subtitle } = getNotificationText(notification);
        const tone = notification.type === 'feed_comment'
          ? 'comment'
          : notification.type === 'feed_reaction'
            ? 'reaction'
          : notification.type === 'feed_witness'
              ? 'witness'
              : (notification.type === 'collaborative_invite'
                || notification.type === 'collaborative_join')
                ? 'invite'
                : notification.type === 'collaborative_progress' || notification.type === 'collaborative_complete'
                  ? 'collaborative'
                  : notification.type === 'calendar_check_in' || notification.type === 'calendar_check_in_open'
                    ? 'checkin'
                    : notification.type === 'calendar_decline'
                      ? 'decline'
                      : notification.type?.startsWith('calendar_')
                        ? 'calendar'
                        : 'generic';
        nextSignals.push({
          id: `notification-${notification.id}`,
          tone,
          title,
          subtitle: subtitle || 'Svar väntar',
          target: getNotificationTarget(notification),
          cta: getNotificationActionLabel(notification),
          notificationId: notification.id,
          notification,
        });
      });

      try {
        const [events, collabs] = await Promise.all([
          getSharedUpcomingEvents(1).catch(() => []),
          getSharedCollaborativeQuests(memberKey).catch(() => []),
        ]);

        const nextEvent = events?.[0];
        if (nextEvent && nextSignals.length < 3) {
          const live = isEventActive(nextEvent.start, nextEvent.end);
          const soon = isEventSoon(nextEvent.start);
          const participation = getCalendarEventParticipationState(S.checkIns, nextEvent.id, me || undefined);
          const needsResponse = isCalendarResponseNeeded(nextEvent.start, participation.hasResponded);

          if (live || needsResponse) {
            nextSignals.push({
              id: `calendar-focus:${nextEvent.id}:${live ? 'live' : 'respond'}`,
              tone: live ? 'checkin' : 'calendar',
              title: live ? 'Live nu' : `Svara på ${nextEvent.title}`,
              subtitle: live
                ? `${participation.checkInCount} incheckad${participation.checkInCount === 1 ? '' : 'e'}`
                : `${getRelativeCalendarLabel(nextEvent.start)} · ${participation.rsvpCount} kommer`,
              target: 'bandhub',
              cta: live ? 'Checka in' : 'Svara',
            });
          } else if (soon && nextSignals.length < 2) {
            nextSignals.push({
              id: `calendar-upcoming:${nextEvent.id}`,
              tone: 'calendar',
              title: 'Snart',
              subtitle: `${nextEvent.title} · ${getRelativeCalendarLabel(nextEvent.start)}`,
              target: 'bandhub',
              cta: 'Kalender',
            });
          }
        }

        const delegated = (S.quests || []).filter((quest: any) => quest.delegatedTo === me && !quest.delegationHandled);
        if (delegated.length > 0 && nextSignals.length < 3) {
          nextSignals.push({
            id: `delegation:${delegated.map((quest: any) => String(quest.id || quest.title)).join('|')}`,
            tone: 'delegation',
            title: `${delegated.length} uppdrag väntar på ditt svar`,
            subtitle: delegated[0]?.title || 'Skickat till dig',
            target: 'quests',
            cta: 'Öppna uppdrag',
          });
        }

        const collabWaiting = collabs.filter((quest: any) =>
          quest.participants?.includes(me) &&
          !(quest.completed_by ?? []).includes(me) &&
          (quest.completed_by ?? []).length > 0
        );

        if (collabWaiting.length > 0 && nextSignals.length < 3) {
          const first = collabWaiting[0];
          nextSignals.push({
            id: `collaborative:${String(first.id || first.quest_id || first.quest_data?.title || 'unknown')}:${collabWaiting.length}`,
            tone: 'collaborative',
            title: `${collabWaiting.length} samarbetsuppdrag väntar`,
            subtitle: first.quest_data?.title || 'Din del väntar',
            target: 'quests',
            cta: 'Quests',
          });
        }
        const hydrated = feed || [];

        const directComments = hydrated.filter((item: any) => {
          const parsed = getFeedCommentMeta(item);
          return item.who !== me && parsed?.targetKey === me && isRecentActivity(item, 48 * 60 * 60 * 1000);
        });

        if (directComments.length > 0 && nextSignals.length < 3) {
          nextSignals.push({
            id: `comments:${String(directComments[0].id || 'latest')}:${directComments.length}`,
            tone: 'comment',
            title: `${directComments.length} kommentar${directComments.length > 1 ? 'er' : ''} till dig`,
            subtitle: `${getMemberName(directComments[0].who)} svarade`,
            target: 'activity',
            cta: 'Svara',
          });
        }

        const feedbackItems = hydrated.filter((item: any) => {
          if (item.who !== me) return false;
          if (!isRecentActivity(item, 48 * 60 * 60 * 1000)) return false;

          const reactionMembers = Object.values(item.reactions ?? {}).flat() as string[];
          const hasExternalReaction = reactionMembers.some((memberId) => memberId && memberId !== me);
          const hasExternalWitness = (item.witnesses ?? []).some((memberId: string) => memberId && memberId !== me);
          return hasExternalReaction || hasExternalWitness;
        });

        if (feedbackItems.length > 0 && nextSignals.length < 3) {
          nextSignals.push({
            id: `feedback:${String(feedbackItems[0].id || 'latest')}:${feedbackItems.length}`,
            tone: 'reaction',
            title: `Respons på ${feedbackItems.length} aktivitet${feedbackItems.length > 1 ? 'er' : ''}`,
            subtitle: 'Aktivitet',
            target: 'activity',
            cta: 'Aktivitet',
          });
        }
      } catch {
        // Ignore transient waiting-on-you failures.
      }

      if (unreadCount > 0 && nextSignals.length < 3) {
        nextSignals.push({
          id: 'notifications',
          tone: 'notifications',
          title: `${unreadCount} olästa notis${unreadCount > 1 ? 'er' : ''}`,
          subtitle: 'Notiser',
          target: 'notifications',
          cta: 'Visa alla',
        });
      }

      if (!cancelled) {
        const nextSignalSlice = nextSignals.slice(0, 3);
        const nextVisibleSignals = includeSeen
          ? nextSignalSlice
          : filterSeenHomeAttentionSignals(memberKey, nextSignalSlice);
        waitingSignalCache.set(memberKey, nextSignalSlice);
        saveCachedWaitingSignals(memberKey, nextSignalSlice);
        cacheCurrentHomeAttentionSignals(memberKey, nextSignalSlice);
        setSignals(nextVisibleSignals);
        setLoading(false);
      }
    }

    void loadSignals();

    if (!supabase) return () => { cancelled = true; };

    const channel = supabase
      .channel('home-attention-signals')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collaborative_quests',
      }, () => { void loadSignals(); })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled, feed, includeSeen, me, notifications, tick, unreadCount]);

  return useMemo(
    () => ({ me, loading, signals, unreadCount }),
    [me, loading, signals, unreadCount],
  );
}

export function useHomeBandEchoSurface() {
  const me = S.me;
  const feed = useGameStore((state) => state.feed);
  const feedHydrated = useGameStore((state) => state.feedHydrated);
  const items = useMemo(() => (
    (feed || [])
      .filter((item: any) => item?.who && item.who !== me)
      .sort((left: any, right: any) => getActivityTimestamp(right) - getActivityTimestamp(left))
      .slice(0, 3)
  ), [feed, me]);

  return {
    me,
    items,
    loading: !feedHydrated && items.length === 0,
    formatActivityAge,
    getHomeEchoSummary,
  };
}
