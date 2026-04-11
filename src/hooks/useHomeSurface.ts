import { useEffect, useMemo, useState } from 'react';
import { S, useGameStore } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { supabase } from '@/lib/supabase';
import { getUpcomingEvents, isEventActive, isEventSoon } from '@/lib/googleCalendar';
import { isQuestDoneNow } from '@/lib/questUtils';
import { getDailyCoachMessage } from '@/hooks/useAI';
import { fetchMyCollaborativeQuests } from '@/lib/collaborativeQuests';
import { fetchBandActivitySnapshot, hydrateFeedItems } from '@/lib/socialData';
import {
  getNotificationActionLabel,
  getNotificationFeedIntent,
  getNotificationTarget,
  getNotificationText,
  sortNotificationsForAttention,
} from '@/lib/notificationMeta';
import { getQuestFocusReason, getRelevantActiveQuests } from '@/lib/questFocus';
import { getDaysSinceActivity, getReengagementStage, isCalendarResponseNeeded } from '@/lib/reengagement';
import { getCalendarEventParticipationState } from '@/lib/calendarState';
import { getFeedCommentMeta } from '@/lib/feed';
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

export function useHomeBandStatusCards(totalMembers: number) {
  const presenceMembers = useGameStore((state) => state.presenceMembers);
  const presenceHydrated = useGameStore((state) => state.presenceHydrated);
  const [activeToday, setActiveToday] = useState(0);
  const [activeNow, setActiveNow] = useState<number | null>(null);
  const [xp48h, setXp48h] = useState(0);
  const [nextEvent, setNextEvent] = useState<{ title: string; date: string } | null>(null);
  const [myRank, setMyRank] = useState<HomeRankSummary | null>(null);

  useEffect(() => {
    async function loadPulse() {
      try {
        const snapshot = await fetchBandActivitySnapshot();
        setActiveToday(snapshot.activeToday);
        setXp48h(snapshot.xp48h);
        setActiveNow(snapshot.activeNow);
      } catch {
        // Ignore transient home pulse failures.
      }
    }

    async function loadNextEvent() {
      try {
        const events = await getUpcomingEvents(1);
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
        const myPos = sorted.findIndex((row: any) => row.key === S.me);
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
      }, () => { void loadPulse(); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'member_presence',
      }, () => { void loadPulse(); })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    getDailyCoachMessage(me)
      .then((msg) => setMessage(msg))
      .finally(() => setLoading(false));
  }, [me]);

  const coachName = me ? ((S.chars[me] as any)?.coachName || 'Coach') : 'Coach';
  const relevantQuests = useMemo(() => (
    me ? getRelevantActiveQuests(S.quests || [], me, 2) : []
  ), [me, S.quests]);
  const focusQuest = relevantQuests[0];
  const followUpQuest = relevantQuests[1];
  const activeQuestCount = useMemo(() => (
    me ? (S.quests || []).filter((quest: any) => quest.owner === me && !isQuestDoneNow(quest)).length : 0
  ), [me, S.quests]);
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
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<HomeReengagementPlan | null>(null);

  useEffect(() => {
    if (!me) return;

    const char = (S.chars as Record<string, any>)?.[me];
    const daysSinceActivity = getDaysSinceActivity(char?.lastSeen, char?.lastQuestDate);
    const stage = getReengagementStage(daysSinceActivity);

    if (stage === 'active') {
      setPlan(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPlan() {
      setLoading(true);

      const focusQuest = getRelevantActiveQuests(S.quests || [], me || undefined, 1)[0];
      const unreadActionable = sortNotificationsForAttention(notifications)
        .find((notification) => !notification.read && getNotificationTarget(notification) !== 'notifications');

      try {
        const [events, collabs] = await Promise.all([
          getUpcomingEvents(2).catch(() => []),
          fetchMyCollaborativeQuests().catch(() => []),
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
              ? 'Bandet är live nu'
              : eventNeedsResponse
                ? 'Kom tillbaka via nästa rep'
                : 'Nästa bandpunkt är nära',
            subtitle: eventLive
              ? `${nextEvent.title} · ${participation?.checkInCount || 0} incheckad${(participation?.checkInCount || 0) === 1 ? '' : 'e'} hittills`
              : eventNeedsResponse
                ? `${nextEvent.title} · ${getRelativeCalendarLabel(nextEvent.start)} · ${participation?.rsvpCount || 0} kommer hittills`
                : `${nextEvent.title} · ${getRelativeCalendarLabel(nextEvent.start)}`,
            cta: 'Öppna kalendern',
            target: 'bandhub',
          };
        } else if (collabWaiting) {
          nextPlan = {
            eyebrow: getReengagementEyebrow(stage),
            title: 'Bandet väntar på din del',
            subtitle: collabWaiting.quest_data?.title || 'Ett gemensamt uppdrag rör sig vidare',
            cta: 'Öppna uppdrag',
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
            title: 'Börja med ett litet nästa steg',
            subtitle: focusQuest.title,
            cta: 'Fortsätt i Quests',
            target: 'quests',
          };
        } else {
          nextPlan = {
            eyebrow: getReengagementEyebrow(stage),
            title: 'Plocka upp tråden med coachen',
            subtitle: getReengagementContext(daysSinceActivity, stage),
            cta: 'Öppna coach',
            target: 'coach',
          };
        }

        if (!cancelled) {
          setPlan(nextPlan);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setPlan({
            eyebrow: getReengagementEyebrow(stage),
            title: 'Kom tillbaka med ett tydligt nästa steg',
            subtitle: getReengagementContext(daysSinceActivity, stage),
            cta: 'Öppna coach',
            target: 'coach',
          });
          setLoading(false);
        }
      }
    }

    void loadPlan();

    return () => {
      cancelled = true;
    };
  }, [me, notifications, tick]);

  return { me, loading, plan };
}

export function useWaitingOnYouSurface() {
  const me = S.me;
  const notifications = useGameStore((state) => state.notifications);
  const unreadCount = useGameStore((state) => state.notifications.filter((notification) => !notification.read).length);
  const tick = useGameStore((state) => state.tick);
  const [signals, setSignals] = useState<HomeAttentionSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    async function loadSignals() {
      setLoading(true);

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
              : notification.type === 'collaborative_invite'
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
          subtitle: subtitle || 'Något väntar på din respons',
          target: getNotificationTarget(notification),
          cta: getNotificationActionLabel(notification),
          notificationId: notification.id,
          notification,
        });
      });

      try {
        const nextEvent = (await getUpcomingEvents(1))?.[0];
        if (nextEvent && nextSignals.length < 3) {
          const live = isEventActive(nextEvent.start, nextEvent.end);
          const soon = isEventSoon(nextEvent.start);
          const participation = getCalendarEventParticipationState(S.checkIns, nextEvent.id, me || undefined);
          const needsResponse = isCalendarResponseNeeded(nextEvent.start, participation.hasResponded);

          if (live || needsResponse) {
            nextSignals.push({
              id: 'calendar-focus',
              tone: live ? 'checkin' : 'calendar',
              title: live ? 'Bandet är live nu' : `Svara på ${nextEvent.title}`,
              subtitle: live
                ? `${participation.checkInCount} incheckad${participation.checkInCount === 1 ? '' : 'e'} · öppna kalendern och checka in`
                : `${getRelativeCalendarLabel(nextEvent.start)} · ${participation.rsvpCount} kommer hittills`,
              target: 'bandhub',
              cta: live ? 'Checka in' : 'Svara nu',
            });
          } else if (soon && nextSignals.length < 2) {
            nextSignals.push({
              id: 'calendar-upcoming',
              tone: 'calendar',
              title: `${nextEvent.title} är snart här`,
              subtitle: `${getRelativeCalendarLabel(nextEvent.start)} · håll rytmen levande i kalendern`,
              target: 'bandhub',
              cta: 'Öppna kalender',
            });
          }
        }
      } catch {
        // Ignore transient calendar failures.
      }

      const delegated = (S.quests || []).filter((quest: any) => quest.delegatedTo === me && !quest.delegationHandled);
      if (delegated.length > 0 && nextSignals.length < 3) {
        nextSignals.push({
          id: 'delegation',
          tone: 'delegation',
          title: `${delegated.length} uppdrag väntar på ditt svar`,
          subtitle: delegated[0]?.title || 'Någon skickade något till dig',
          target: 'quests',
          cta: 'Öppna uppdrag',
        });
      }

      try {
        const collabs = await fetchMyCollaborativeQuests();
        const collabWaiting = collabs.filter((quest: any) =>
          quest.participants?.includes(me) &&
          !(quest.completed_by ?? []).includes(me) &&
          (quest.completed_by ?? []).length > 0
        );

        if (collabWaiting.length > 0 && nextSignals.length < 3) {
          const first = collabWaiting[0];
          nextSignals.push({
            id: 'collaborative',
            tone: 'collaborative',
            title: `${collabWaiting.length} samarbetsuppdrag rör sig utan dig`,
            subtitle: first.quest_data?.title || 'Din del väntar fortfarande',
            target: 'quests',
            cta: 'Hoppa in',
          });
        }
      } catch {
        // Ignore transient collaborative quest failures.
      }

      try {
        const { data } = await supabase
          .from('activity_feed')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(40);
        const hydrated = await hydrateFeedItems(data || []);

        const directComments = hydrated.filter((item: any) => {
          const parsed = getFeedCommentMeta(item);
          return item.who !== me && parsed?.targetKey === me && isRecentActivity(item, 48 * 60 * 60 * 1000);
        });

        if (directComments.length > 0 && nextSignals.length < 3) {
          nextSignals.push({
            id: 'comments',
            tone: 'comment',
            title: `${directComments.length} kommentar${directComments.length > 1 ? 'er' : ''} till dig`,
            subtitle: `${getMemberName(directComments[0].who)} svarade på din aktivitet`,
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
            id: 'feedback',
            tone: 'reaction',
            title: `Respons på ${feedbackItems.length} av dina aktiviteter`,
            subtitle: 'Öppna feeden och svara medan det är levande',
            target: 'activity',
            cta: 'Se aktivitet',
          });
        }
      } catch {
        // Ignore transient activity failures.
      }

      if (unreadCount > 0 && nextSignals.length < 3) {
        nextSignals.push({
          id: 'notifications',
          tone: 'notifications',
          title: `${unreadCount} olästa notis${unreadCount > 1 ? 'er' : ''}`,
          subtitle: 'Något har hänt sedan sist',
          target: 'notifications',
          cta: 'Visa alla',
        });
      }

      if (!cancelled) {
        setSignals(nextSignals.slice(0, 3));
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
        table: 'activity_feed',
      }, () => { void loadSignals(); })
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
  }, [me, notifications, tick, unreadCount]);

  return { me, loading, signals, unreadCount };
}

export function useHomeBandEchoSurface() {
  const me = S.me;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    async function loadEcho() {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('activity_feed')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(24);

        const hydrated = await hydrateFeedItems(data || []);
        const others = hydrated
          .filter((item: any) => item?.who && item.who !== me)
          .sort((left: any, right: any) => getActivityTimestamp(right) - getActivityTimestamp(left))
          .slice(0, 3);

        if (!cancelled) {
          setItems(others);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEcho();

    const channel = supabase
      .channel('home-band-echo')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activity_feed',
      }, () => { void loadEcho(); })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [me]);

  return {
    me,
    items,
    loading,
    formatActivityAge,
    getHomeEchoSummary,
  };
}
