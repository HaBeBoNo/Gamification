import React, { useState, useEffect } from 'react';
import { S, useGameStore } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { Zap, CalendarDays, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getUpcomingEvents } from '@/lib/googleCalendar';
import { isQuestDoneNow } from '@/lib/questUtils';
import { getDailyCoachMessage } from '@/hooks/useAI';
import { fetchMyCollaborativeQuests } from '@/lib/collaborativeQuests';
import { markRead, type Notification } from '@/state/notifications';
import { setFeedIntent } from '@/lib/feedIntent';
import { getNotificationActionLabel, getNotificationFeedIntent, getNotificationPriority, getNotificationTarget, getNotificationText, type NotificationTarget } from '@/lib/notificationMeta';
import { fetchBandActivitySnapshot, hydrateFeedItems } from '@/lib/socialData';
import { getFeedCommentMeta } from '@/lib/feed';
import { getQuestFocusReason, getRelevantActiveQuests } from '@/lib/questFocus';

const MOBILE_GUTTER = 'var(--layout-gutter-mobile)';
const ROOM_GUTTER = 'var(--layout-gutter-room)';
const SECTION_GAP = 'var(--section-gap)';
const SECTION_GAP_COMPACT = 'var(--section-gap-compact)';
const CARD_PAD = 'var(--card-padding)';
const CARD_PAD_COMPACT = 'var(--card-padding-compact)';
const CARD_PAD_ROOM = 'var(--card-padding-room)';
const CONTROL_HEIGHT = 'var(--control-height)';
const ICON_BUTTON_SIZE = 'var(--icon-button-size)';

function startOfLocalDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function getRelativeCalendarLabel(dateStr: string): string {
  const eventDate = new Date(dateStr);
  if (Number.isNaN(eventDate.getTime())) return '';

  const today = startOfLocalDay(new Date());
  const target = startOfLocalDay(eventDate);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return 'Idag';
  if (diffDays === 1) return 'Imorgon';
  return eventDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

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
        padding: `${CARD_PAD_ROOM} ${ROOM_GUTTER} ${CARD_PAD}`,
        display: 'flex',
        alignItems: 'center',
        gap: SECTION_GAP,
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
      padding: `${CARD_PAD_ROOM} ${ROOM_GUTTER} ${CARD_PAD}`,
      display: 'flex',
      alignItems: 'center',
      gap: SECTION_GAP,
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
        const snapshot = await fetchBandActivitySnapshot();
        setActiveToday(snapshot.activeToday);
        setXp48h(snapshot.xp48h);
        setActiveNow(snapshot.activeNow);
      } catch {}
    }

    async function loadNextEvent() {
      try {
        const events = await getUpcomingEvents(1);
        const ev = events?.[0];
        if (!ev) return;
        const label = getRelativeCalendarLabel(ev.start);
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
      icon: Zap,
      value: `${activeToday}/8`,
      label: 'Aktiva idag',
      sub: activeNow !== null ? `${activeNow} live nu · ${xp48h} XP / 48h` : `${xp48h} XP · 48h`,
    },
    nextEvent ? {
      icon: CalendarDays,
      value: nextEvent.date,
      label: nextEvent.title,
      sub: 'Nästa event',
    } : {
      icon: CalendarDays,
      value: '—',
      label: 'Inga events',
      sub: 'Lägg till i kalendern',
    },
    myRank ? {
      icon: Trophy,
      value: `#${myRank.pos}`,
      label: myRank.pos === 1 ? 'Du leder!' : `${myRank.gap} XP till #${myRank.pos - 1}`,
      sub: myRank.pos === 1 ? 'Håll positionen' : myRank.above,
    } : {
      icon: Trophy,
      value: '—',
      label: 'Ranking',
      sub: 'Slutför quests för XP',
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: SECTION_GAP_COMPACT,
      padding: `0 ${MOBILE_GUTTER}`,
    }}>
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div key={i} style={{
            background: 'var(--color-surface-elevated)',
            borderRadius: 'var(--radius-card)',
            padding: CARD_PAD_COMPACT,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-secondary)',
              marginBottom: 2,
            }}>
              <Icon size={16} strokeWidth={1.9} />
            </div>
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
        );
      })}
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

function getActivityTimestamp(item: any): number {
  const raw = item?.created_at ?? item?.ts ?? item?.time ?? item?.t;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatActivityAge(item: any): string {
  const ts = getActivityTimestamp(item);
  if (!ts) return '';

  const diff = Date.now() - ts;
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m sedan`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h sedan`;

  const days = Math.floor(hours / 24);
  return `${days}d sedan`;
}

function getHomeEchoSummary(item: any): { title: string; body: string } {
  const actor = getMemberName(item?.who);
  const commentMeta = getFeedCommentMeta(item);

  if (commentMeta) {
    return {
      title: `${actor} kommenterade`,
      body: commentMeta.comment || item?.action || 'Svarade i tråden',
    };
  }

  return {
    title: actor,
    body: item?.action || 'Gjorde något i bandet',
  };
}

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
  const relevantQuests = getRelevantActiveQuests(S.quests || [], me, 2);
  const focusQuest = relevantQuests[0];
  const followUpQuest = relevantQuests[1];
  const activeQuestCount = (S.quests || []).filter((q: any) => q.owner === me && !isQuestDoneNow(q)).length;
  const latestSocial = (S.feed || []).find((item: any) => item.who && item.who !== me);

  return (
    <div style={{ padding: `0 ${MOBILE_GUTTER}` }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: `0 0 ${SECTION_GAP_COMPACT}`,
      }}>
        Läget just nu
      </p>
      <div
        onClick={() => onOpenCoach?.(message)}
        style={{
          background: 'linear-gradient(145deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%)',
          borderRadius: 'var(--radius-card)',
          padding: CARD_PAD_ROOM,
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          marginBottom: SECTION_GAP_COMPACT,
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
            height: ICON_BUTTON_SIZE,
            width: ICON_BUTTON_SIZE,
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
          marginBottom: SECTION_GAP,
          minHeight: 52,
        }}>
          {loading ? 'Coach kalibrerar läget...' : message}
        </div>

        {focusQuest && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: CARD_PAD,
            marginBottom: SECTION_GAP_COMPACT,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}>
              Nästa steg
            </div>
            <div style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text)',
              fontWeight: 600,
              marginBottom: 4,
            }}>
              {focusQuest.title}
            </div>
            <div style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-muted)',
              lineHeight: 1.45,
            }}>
              {getQuestFocusReason(focusQuest, me)}
            </div>
            {followUpQuest && (
              <div style={{
                marginTop: SECTION_GAP_COMPACT,
                fontSize: 'var(--text-micro)',
                color: 'var(--color-text-muted)',
              }}>
                Efter det: {followUpQuest.title}
              </div>
            )}
          </div>
        )}

        {latestSocial && (
          <div style={{
            fontSize: 'var(--text-micro)',
            color: 'var(--color-text-muted)',
            marginBottom: SECTION_GAP_COMPACT,
          }}>
            Senaste puls: {(MEMBERS as Record<string, any>)[latestSocial.who]?.name || latestSocial.who} {latestSocial.action}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate?.('quests');
            }}
            style={{
              flex: 1,
              background: 'var(--color-primary)',
              color: 'var(--color-surface)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              minHeight: CONTROL_HEIGHT,
              padding: '0 var(--space-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-caption)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: 'pointer',
            }}
          >
            Fortsätt nu
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenCoach?.(message);
            }}
            style={{
              flex: 1,
              background: 'transparent',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              minHeight: CONTROL_HEIGHT,
              padding: '0 var(--space-md)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-caption)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: 'pointer',
            }}
          >
            Öppna coach
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
    case 'calendar_rsvp':
      return '📅';
    case 'calendar_check_in':
      return '📍';
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
    <div style={{ padding: `0 ${MOBILE_GUTTER}` }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: `0 0 ${SECTION_GAP_COMPACT}`,
      }}>
        Väntar på dig
      </p>
      <div style={{
        background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{
            padding: CARD_PAD_ROOM,
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
                gap: SECTION_GAP_COMPACT,
                padding: `${CARD_PAD} ${CARD_PAD_ROOM}`,
                background: 'transparent',
                border: 'none',
                borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: ICON_BUTTON_SIZE,
                height: ICON_BUTTON_SIZE,
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

function HomeBandEcho({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void;
}) {
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

  return (
    <div style={{ padding: `0 ${MOBILE_GUTTER}` }}>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: `0 0 ${SECTION_GAP_COMPACT}`,
      }}>
        Från bandet
      </p>
      <div style={{
        background: 'var(--color-surface-elevated)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{
            padding: CARD_PAD_ROOM,
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-caption)',
          }}>
            Lyssnar in bandet...
          </div>
        ) : items.length === 0 ? (
          <div style={{
            padding: CARD_PAD_ROOM,
            display: 'flex',
            flexDirection: 'column',
            gap: SECTION_GAP_COMPACT,
          }}>
            <div style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text)',
              fontWeight: 600,
            }}>
              Det är lugnt i bandet just nu.
            </div>
            <div style={{
              fontSize: 'var(--text-micro)',
              color: 'var(--color-text-muted)',
              lineHeight: 1.45,
            }}>
              När någon annan rör sig dyker det upp här först. Hela flödet finns fortfarande under Aktivitet.
            </div>
            <button
              onClick={() => onNavigate?.('activity')}
              style={{
                alignSelf: 'flex-start',
                marginTop: 'var(--space-xs)',
                background: 'transparent',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-pill)',
                minHeight: CONTROL_HEIGHT,
                padding: '0 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Öppna flödet
            </button>
          </div>
        ) : (
          <>
            {items.map((item, index) => {
              const summary = getHomeEchoSummary(item);
              const actor = item?.who;
              return (
                <button
                  key={String(item?.id || index)}
                  onClick={() => onNavigate?.('activity')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: SECTION_GAP_COMPACT,
                    padding: `${CARD_PAD} ${CARD_PAD_ROOM}`,
                    background: 'transparent',
                    border: 'none',
                    borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    <MemberIcon id={actor} size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 'var(--space-sm)',
                      marginBottom: 4,
                    }}>
                      <div style={{
                        fontSize: 'var(--text-caption)',
                        color: 'var(--color-text)',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {summary.title}
                      </div>
                      <div style={{
                        fontSize: 'var(--text-micro)',
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                      }}>
                        {formatActivityAge(item)}
                      </div>
                    </div>
                    <div style={{
                      fontSize: 'var(--text-caption)',
                      color: 'var(--color-text-muted)',
                      lineHeight: 1.5,
                    }}>
                      {summary.body}
                    </div>
                  </div>
                </button>
              );
            })}
            <div style={{
              padding: `0 ${CARD_PAD_ROOM} ${CARD_PAD_ROOM}`,
            }}>
              <button
                onClick={() => onNavigate?.('activity')}
                style={{
                  width: '100%',
                  background: 'transparent',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-pill)',
                  minHeight: CONTROL_HEIGHT,
                  padding: '0 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-micro)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Se hela flödet
              </button>
            </div>
          </>
        )}
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
      gap: SECTION_GAP,
      paddingBottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + var(--space-xl))',
    }}>
      <HeroCard />
      <BandStatusRow />
      <DailyCoachCard onNavigate={onNavigate} onOpenCoach={onOpenCoach} />
      <WaitingOnYouCard
        onNavigate={onNavigate}
        onOpenNotifications={onOpenNotifications}
        onOpenCoach={onOpenCoach}
      />
      <HomeBandEcho onNavigate={onNavigate} />
    </div>
  );
}

export default HomeScreen;
