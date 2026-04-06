import React, { useState, useEffect } from 'react';
import { S, useGameStore } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import ActivityFeed from './ActivityFeed';
import { supabase } from '@/lib/supabase';
import { getUpcomingEvents } from '@/lib/googleCalendar';
import { isQuestDoneNow } from '@/lib/questUtils';
import { getDailyCoachMessage } from '@/hooks/useAI';
import { fetchMyCollaborativeQuests } from '@/lib/collaborativeQuests';
import { markRead, type Notification } from '@/state/notifications';
import { setFeedIntent } from '@/lib/feedIntent';
import { getNotificationActionLabel, getNotificationFeedIntent, getNotificationPriority, getNotificationTarget, getNotificationText, type NotificationTarget } from '@/lib/notificationMeta';
import { RUNTIME_ISSUE_CLEAR_EVENT, RUNTIME_ISSUE_EVENT, getRuntimeIssues, type RuntimeIssue } from '@/lib/runtimeHealth';
import { fetchPresenceSnapshot, hydrateFeedItems } from '@/lib/socialData';
import { getFeedCommentMeta } from '@/lib/feed';

// ── HeroCard ────────────────────────────────────────────────────────
function HeroCard() {
  const memberKey = S.me!;
  const member = (MEMBERS as Record<string, any>)[memberKey];
  const char = (S.chars as Record<string, any>)?.[memberKey];

  // Show skeleton while loading
  if (!char) {
    return (
      <div style={{
        background: 'linear-gradient(160deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%)',
        borderBottom: '1px solid var(--color-border)',
        padding: 'var(--space-xl) var(--space-lg) var(--space-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-lg)',
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'var(--color-border)', flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            height: 20, borderRadius: 4,
            background: 'var(--color-border)', marginBottom: 'var(--space-sm)',
            width: '60%',
          }} />
          <div style={{
            height: 16, borderRadius: 4,
            background: 'var(--color-border)', marginBottom: 'var(--space-sm)',
            width: '40%',
          }} />
          <div style={{
            height: 3, borderRadius: 2,
            background: 'var(--color-border)', marginBottom: 'var(--space-sm)',
          }} />
          <div style={{
            height: 12, borderRadius: 3,
            background: 'var(--color-border)',
            width: '50%',
          }} />
        </div>
      </div>
    );
  }

  const xp = char?.xp ?? 0;
  const xpToNext = char?.xpToNext ?? 100;
  const level = char?.level ?? 1;
  const pct = Math.min(100, Math.round((xp / xpToNext) * 100));

  // SVG progress ring
  const R = 44;
  const circ = 2 * Math.PI * R;
  const offset = circ - (pct / 100) * circ;

  return (
    <div style={{
      background: 'linear-gradient(160deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%)',
      borderBottom: '1px solid var(--color-border)',
      padding: 'var(--space-xl) var(--space-lg) var(--space-lg)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-lg)',
    }}>
      {/* Progress ring med avatar inuti */}
      <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
        <svg width={96} height={96} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
          <circle cx={48} cy={48} r={R} fill="none" stroke="var(--color-border)" strokeWidth={4} />
          <circle
            cx={48} cy={48} r={R}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={4}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 8,
          borderRadius: '50%',
          background: 'var(--color-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MemberIcon id={memberKey} size={40} />
        </div>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 2 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-micro)',
            color: 'var(--color-surface)',
            background: 'var(--color-primary)',
            borderRadius: 'var(--radius-pill)',
            padding: '1px 8px',
          }}>
            LVL {level}
          </span>
          <span style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {pct}%
          </span>
        </div>
        <h2 style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-subheading)',
          color: 'var(--color-text)',
          margin: '0 0 2px',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {member?.name ?? memberKey}
        </h2>
        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-sm)' }}>
          {member?.role}
          {member?.roleType && (
            <span style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)', textTransform: 'uppercase', marginLeft: 6 }}>
              · {member.roleType}
            </span>
          )}
        </p>
        {/* XP bar */}
        <div style={{ height: 3, borderRadius: 99, background: 'var(--color-border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--color-primary)',
            borderRadius: 99,
            transition: 'width 0.6s ease',
          }} />
        </div>
        <p style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
          {xp} / {xpToNext} XP
        </p>
      </div>
    </div>
  );
}

// ── BandStatusRow ───────────────────────────────────────────────────
function BandStatusRow() {
  const [activeToday, setActiveToday] = useState(0);
  const [activeNow, setActiveNow] = useState<number | null>(null);
  const [xp48h, setXp48h] = useState(0);
  const [nextEvent, setNextEvent] = useState<{ title: string; date: string } | null>(null);
  const [myRank, setMyRank] = useState<{ pos: number; gap: number; above: string } | null>(null);

  useEffect(() => {
    async function loadPulse() {
      try {
        const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const [{ data }, presence] = await Promise.all([
          supabase
            .from('activity_feed')
            .select('who, xp, created_at')
            .gte('created_at', since),
          fetchPresenceSnapshot(),
        ]);
        if (!data) return;
        const todayStr = new Date().toDateString();
        const active = new Set(
          data.filter((i: any) => new Date(i.created_at).toDateString() === todayStr).map((i: any) => i.who)
        );
        setActiveToday(active.size);
        setXp48h(data.reduce((s: number, i: any) => s + (i.xp ?? 0), 0));
        setActiveNow(presence.supported ? presence.activeNow : null);
      } catch {}
    }

    async function loadNextEvent() {
      try {
        const events = await getUpcomingEvents(1);
        const ev = events?.[0];
        if (!ev) return;
        const d = new Date(ev.start);
        const now = new Date();
        const diffMs = d.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / 86400000);
        const label =
          diffDays <= 0 && diffMs > 0 ? 'Idag' :
          diffDays === 0 ? 'Idag' :
          diffDays === 1 ? 'Imorgon' :
          d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
        setNextEvent({ title: ev.title, date: label });
      } catch {}
    }

    async function loadRank() {
      try {
        const { data } = await supabase.from('member_data').select('member_key, data');
        if (!data) return;
        const sorted = data
          .map((r: any) => {
            const totalXp =
              r.data?.chars?.[r.member_key]?.totalXp ??
              r.data?.totalXP ?? 0;
            return { key: r.member_key, xp: totalXp };
          })
          .sort((a: any, b: any) => b.xp - a.xp);
        const myPos = sorted.findIndex((r: any) => r.key === S.me);
        if (myPos < 0) return;
        const pos = myPos + 1;
        const above = myPos > 0 ? sorted[myPos - 1] : null;
        const gap = above ? above.xp - sorted[myPos].xp : 0;
        const aboveMember = above ? (MEMBERS as Record<string, any>)[above.key] : null;
        setMyRank({ pos, gap, above: aboveMember?.name ?? above?.key ?? '' });
      } catch {}
    }

    loadPulse();
    loadNextEvent();
    loadRank();

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

  const cards = [
    {
      icon: '⚡',
      value: `${activeToday}/8`,
      label: 'Aktiva idag',
      sub: activeNow !== null ? `${activeNow} live nu · ${xp48h} XP / 48h` : `${xp48h} XP · 48h`,
    },
    nextEvent ? {
      icon: '📅',
      value: nextEvent.date,
      label: nextEvent.title,
      sub: 'Nästa event',
    } : {
      icon: '📅',
      value: '—',
      label: 'Inga events',
      sub: 'Lägg till i kalendern',
    },
    myRank ? {
      icon: '🏆',
      value: `#${myRank.pos}`,
      label: myRank.pos === 1 ? 'Du leder!' : `${myRank.gap} XP till #${myRank.pos - 1}`,
      sub: myRank.pos === 1 ? 'Håll positionen' : myRank.above,
    } : {
      icon: '🏆',
      value: '—',
      label: 'Ranking',
      sub: 'Slutför quests för XP',
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 'var(--space-sm)',
      padding: '0 var(--space-md)',
    }}>
      {cards.map((card, i) => (
        <div key={i} style={{
          background: 'var(--color-surface-elevated)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <span style={{ fontSize: 18, marginBottom: 2 }}>{card.icon}</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-subheading)',
            color: 'var(--color-text)',
            fontWeight: 700,
            lineHeight: 1,
          }}>
            {card.value}
          </span>
          <span style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {card.label}
          </span>
          <span style={{
            fontSize: 'var(--text-micro)',
            color: 'var(--color-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {card.sub}
          </span>
        </div>
      ))}
    </div>
  );
}

function getMemberName(memberKey?: string): string {
  if (!memberKey) return 'Någon';
  return (MEMBERS as Record<string, any>)[memberKey]?.name || memberKey;
}

type AttentionSignal = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  target: NotificationTarget;
  cta: string;
  notificationId?: string | number;
  notification?: Notification;
};

function DailyCoachCard({
  onNavigate,
  onOpenCoach,
}: {
  onNavigate?: (tab: string) => void;
  onOpenCoach?: (initialMessage?: string) => void;
}) {
  const me = S.me;
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    setLoading(true);
    getDailyCoachMessage(me)
      .then((msg) => setMessage(msg))
      .finally(() => setLoading(false));
  }, [me]);

  if (!me) return null;

  const coachName = (S.chars[me] as any)?.coachName || 'Coach';
  const activeQuestCount = (S.quests || []).filter((q: any) => q.owner === me && !isQuestDoneNow(q)).length;
  const latestSocial = (S.feed || []).find((item: any) => item.who && item.who !== me);

  return (
    <div style={{ padding: '0 var(--space-md)' }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '0 0 var(--space-sm)',
      }}>
        Dagens riktning
      </p>
      <div
        onClick={() => onOpenCoach?.(message)}
        style={{
          background: 'linear-gradient(145deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-lg)',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginBottom: 'var(--space-md)',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 4,
            }}>
              {coachName}
            </div>
            <div style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-muted)',
            }}>
              {activeQuestCount > 0 ? `${activeQuestCount} aktiva uppdrag just nu` : 'Dags att välja nästa steg'}
            </div>
          </div>
          <div style={{
            minWidth: 40,
            height: 40,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-primary-muted)',
            color: 'var(--color-primary)',
            fontSize: 18,
          }}>
            ✦
          </div>
        </div>

        <div style={{
          fontSize: 'var(--text-body)',
          color: 'var(--color-text)',
          lineHeight: 1.55,
          marginBottom: 'var(--space-md)',
          minHeight: 44,
        }}>
          {loading ? 'Coach kalibrerar dagens riktning...' : message}
        </div>

        {latestSocial && (
          <div style={{
            fontSize: 'var(--text-micro)',
            color: 'var(--color-text-muted)',
            marginBottom: 'var(--space-md)',
          }}>
            Senaste puls: {(MEMBERS as Record<string, any>)[latestSocial.who]?.name || latestSocial.who} {latestSocial.action}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenCoach?.(message);
            }}
            style={{
              flex: 1,
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-sm) var(--space-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-caption)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: 'pointer',
            }}
          >
            Öppna coach
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate?.('quests');
            }}
            style={{
              flex: 1,
              background: 'transparent',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-sm) var(--space-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-caption)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: 'pointer',
            }}
          >
            Gå till uppdrag
          </button>
        </div>
      </div>
    </div>
  );
}

function getSignalIcon(notification: Notification): string {
  switch (notification.type) {
    case 'feed_comment':
      return '💬';
    case 'feed_reaction':
      return '👏';
    case 'feed_witness':
      return '👀';
    case 'delegation_received':
      return '📥';
    case 'collaborative_complete':
      return '🤝';
    default:
      return '🔔';
  }
}

function WaitingOnYouCard({
  onNavigate,
  onOpenNotifications,
  onOpenCoach,
}: {
  onNavigate?: (tab: string) => void;
  onOpenNotifications?: () => void;
  onOpenCoach?: (initialMessage?: string) => void;
}) {
  const me = S.me;
  const notifications = useGameStore(s => s.notifications);
  const unreadCount = useGameStore(s => s.notifications.filter(n => !n.read).length);
  const [signals, setSignals] = useState<AttentionSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    async function loadSignals() {
      setLoading(true);

      const nextSignals: AttentionSignal[] = [];
      const unreadActionable = notifications
        .filter((notification) => !notification.read)
        .filter((notification) => getNotificationTarget(notification) !== 'notifications')
        .sort((a, b) => (
          getNotificationPriority(b) - getNotificationPriority(a) ||
          b.ts - a.ts
        ))
        .slice(0, 2);

      unreadActionable.forEach((notification) => {
        const { title, subtitle } = getNotificationText(notification);
        nextSignals.push({
          id: `notification-${notification.id}`,
          icon: getSignalIcon(notification),
          title,
          subtitle: subtitle || 'Något väntar på din respons',
          target: getNotificationTarget(notification),
          cta: getNotificationActionLabel(notification),
          notificationId: notification.id,
          notification,
        });
      });

      const delegated = (S.quests || []).filter(
        (q: any) => q.delegatedTo === me && !q.delegationHandled
      );

      if (delegated.length > 0 && nextSignals.length < 3) {
        nextSignals.push({
          id: 'delegation',
          icon: '📥',
          title: `${delegated.length} uppdrag väntar på ditt svar`,
          subtitle: delegated[0]?.title || 'Någon skickade något till dig',
          target: 'quests',
          cta: 'Öppna uppdrag',
        });
      }

      try {
        const collabs = await fetchMyCollaborativeQuests();
        const collabWaiting = collabs.filter((q: any) =>
          q.participants?.includes(me) &&
          !(q.completed_by ?? []).includes(me) &&
          (q.completed_by ?? []).length > 0
        );

        if (collabWaiting.length > 0 && nextSignals.length < 3) {
          const first = collabWaiting[0];
          nextSignals.push({
            id: 'collaborative',
            icon: '🤝',
            title: `${collabWaiting.length} samarbetsuppdrag rör sig utan dig`,
            subtitle: first.quest_data?.title || 'Din del väntar fortfarande',
            target: 'quests',
            cta: 'Hoppa in',
          });
        }
      } catch {}

      try {
        const { data } = await supabase
          .from('activity_feed')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(40);
        const hydrated = await hydrateFeedItems(data || []);

        const directComments = hydrated.filter((item: any) => {
          const parsed = getFeedCommentMeta(item);
          return item.who !== me && parsed?.targetKey === me;
        });

        if (directComments.length > 0 && nextSignals.length < 3) {
          nextSignals.push({
            id: 'comments',
            icon: '💬',
            title: `${directComments.length} kommentar${directComments.length > 1 ? 'er' : ''} till dig`,
            subtitle: `${getMemberName(directComments[0].who)} svarade på din aktivitet`,
            target: 'activity',
            cta: 'Svara',
          });
        }

        const feedbackItems = hydrated.filter((item: any) => {
          if (item.who !== me) return false;

          const reactionMembers = Object.values(item.reactions ?? {}).flat() as string[];
          const hasExternalReaction = reactionMembers.some(memberId => memberId && memberId !== me);
          const hasExternalWitness = (item.witnesses ?? []).some((memberId: string) => memberId && memberId !== me);

          return hasExternalReaction || hasExternalWitness;
        });

        if (feedbackItems.length > 0 && nextSignals.length < 3) {
          nextSignals.push({
            id: 'feedback',
            icon: '👏',
            title: `Respons på ${feedbackItems.length} av dina aktiviteter`,
            subtitle: 'Öppna feeden och svara medan det är levande',
            target: 'activity',
            cta: 'Se aktivitet',
          });
        }
      } catch {}

      if (unreadCount > 0 && nextSignals.length < 3) {
        nextSignals.push({
          id: 'notifications',
          icon: '🔔',
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
  }, [me, notifications, unreadCount]);

  if (!me || (!loading && signals.length === 0)) return null;

  return (
    <div style={{ padding: '0 var(--space-md)' }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '0 0 var(--space-sm)',
      }}>
        Väntar på dig
      </p>
      <div style={{
        background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{
            padding: 'var(--space-lg)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-caption)',
          }}>
            Läser av gruppens puls...
          </div>
        ) : (
          signals.map((signal, index) => (
            <button
              key={signal.id}
              onClick={() => {
                if (signal.notificationId) markRead(signal.notificationId);
                if (signal.notification) {
                  const feedIntent = getNotificationFeedIntent(signal.notification);
                  if (feedIntent) setFeedIntent(feedIntent);
                }

                if (signal.target === 'notifications') {
                  onOpenNotifications?.();
                  return;
                }

                if (signal.target === 'coach') {
                  onOpenCoach?.();
                  return;
                }

                onNavigate?.(signal.target);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                background: 'transparent',
                border: 'none',
                borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-surface)',
                flexShrink: 0,
                fontSize: 18,
              }}>
                {signal.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--color-text)',
                  fontWeight: 600,
                  marginBottom: 2,
                }}>
                  {signal.title}
                </div>
                <div style={{
                  fontSize: 'var(--text-micro)',
                  color: 'var(--color-text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {signal.subtitle}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {signal.cta}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── FeaturedQuest ───────────────────────────────────────────────────
function FeaturedQuest({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const memberKey = S.me;
  // Först: mina egna ej slutförda quests. Fallback: vilken som helst ej slutförd.
  const myQuest = (S.quests ?? []).find((q: any) => !isQuestDoneNow(q) && q.owner === memberKey);
  const anyQuest = (S.quests ?? []).find((q: any) => !isQuestDoneNow(q));
  const quest: any = myQuest || anyQuest;
  if (!quest) return null;

  const questXp = quest.xp ?? quest.reward?.xp ?? '?';

  return (
    <div style={{ padding: '0 var(--space-md)' }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '0 0 var(--space-sm)',
      }}>
        Nästa uppdrag
      </p>
      <div style={{
        background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-lg)',
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
          <h3 style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', margin: 0, fontWeight: 600 }}>
            {quest.title}
          </h3>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-micro)',
            color: 'var(--color-primary)',
            background: 'var(--color-primary-muted)',
            borderRadius: 'var(--radius-pill)',
            padding: '2px 8px',
            whiteSpace: 'nowrap',
            marginLeft: 'var(--space-sm)',
          }}>
            {questXp} XP
          </span>
        </div>
        {(quest.desc || quest.description) && (
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', margin: '0 0 var(--space-md)' }}>
            {quest.desc || quest.description}
          </p>
        )}
        <button
          onClick={() => onNavigate?.('quests')}
          style={{
            width: '100%',
            background: 'var(--color-primary)',
            color: 'var(--color-surface)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-sm) var(--space-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-caption)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          Påbörja →
        </button>
      </div>
    </div>
  );
}

function getRuntimeIssueMeta(issue: RuntimeIssue): { icon: string; title: string; subtitle: string } {
  switch (issue.service) {
    case 'ai':
      return {
        icon: 'AI',
        title: 'Coachen kor i reservlage',
        subtitle: issue.message,
      };
    case 'push':
      return {
        icon: '!',
        title: 'Push-signaler ar begransade',
        subtitle: issue.message,
      };
    case 'sync':
      return {
        icon: '~',
        title: 'Serverkopplingen ar ojämn',
        subtitle: issue.message,
      };
    default:
      return {
        icon: '?',
        title: 'Systemstatus',
        subtitle: issue.message,
      };
  }
}

function RuntimeStatusCard() {
  const [issues, setIssues] = useState<RuntimeIssue[]>(() => getRuntimeIssues());

  useEffect(() => {
    const refresh = () => setIssues(getRuntimeIssues());
    window.addEventListener(RUNTIME_ISSUE_EVENT, refresh);
    window.addEventListener(RUNTIME_ISSUE_CLEAR_EVENT, refresh);
    return () => {
      window.removeEventListener(RUNTIME_ISSUE_EVENT, refresh);
      window.removeEventListener(RUNTIME_ISSUE_CLEAR_EVENT, refresh);
    };
  }, []);

  if (issues.length === 0) return null;

  return (
    <div style={{ padding: '0 var(--space-md)' }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '0 0 var(--space-sm)',
      }}>
        Systempuls
      </p>
      <div style={{
        background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {issues.map((issue, index) => {
          const meta = getRuntimeIssueMeta(issue);
          return (
            <div
              key={`${issue.service}-${issue.ts}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-primary-muted)',
                color: 'var(--color-primary)',
                flexShrink: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                fontWeight: 700,
              }}>
                {meta.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--color-text)',
                  fontWeight: 600,
                  marginBottom: 2,
                }}>
                  {meta.title}
                </div>
                <div style={{
                  fontSize: 'var(--text-micro)',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.4,
                }}>
                  {meta.subtitle}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── HomeScreen ──────────────────────────────────────────────────────
interface HomeScreenProps {
  rerender: () => void;
  onMetricClick?: () => void;
  onNavigate?: (tab: string) => void;
  onOpenCoach?: (initialMessage?: string) => void;
  onOpenNotifications?: () => void;
}

export function HomeScreen({ onNavigate, onOpenCoach, onOpenNotifications }: HomeScreenProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)',
      paddingBottom: 'calc(var(--nav-height, 80px) + var(--space-xl))',
    }}>
      <HeroCard />
      <BandStatusRow />
      <RuntimeStatusCard />
      <DailyCoachCard onNavigate={onNavigate} onOpenCoach={onOpenCoach} />
      <WaitingOnYouCard
        onNavigate={onNavigate}
        onOpenNotifications={onOpenNotifications}
        onOpenCoach={onOpenCoach}
      />
      <FeaturedQuest onNavigate={onNavigate} />
      <div style={{ padding: '0 var(--space-md)' }}>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-micro)',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          margin: '0 0 var(--space-sm)',
        }}>
          Aktivitet
        </p>
        <ActivityFeed hideHeader={true} />
      </div>
    </div>
  );
}

export default HomeScreen;
