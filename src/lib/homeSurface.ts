import { MEMBERS } from '@/data/members';
import { getFeedCommentMeta } from '@/lib/feed';
import type { Notification } from '@/types/game';
import type { NotificationTarget } from '@/lib/notificationMeta';

export type HomeRankSummary = {
  pos: number;
  gap: number;
  above: string;
};

export type HomeBandStatusCard = {
  kind: 'activity' | 'calendar' | 'rank';
  value: string;
  label: string;
  sub: string;
};

export type HomeAttentionSignal = {
  id: string;
  title: string;
  subtitle: string;
  target: NotificationTarget | 'notifications';
  cta: string;
  notificationId?: string | number;
  notification?: Notification;
  tone:
    | 'comment'
    | 'reaction'
    | 'witness'
    | 'invite'
    | 'collaborative'
    | 'delegation'
    | 'calendar'
    | 'decline'
    | 'checkin'
    | 'notifications'
    | 'generic';
};

export type HomeReengagementPlan = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  target: NotificationTarget | 'notifications';
};

export function getMemberName(memberKey?: string): string {
  if (!memberKey) return 'Någon';
  return (MEMBERS as Record<string, { name?: string }>)[memberKey]?.name || memberKey;
}

function startOfLocalDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function getRelativeCalendarLabel(dateStr: string): string {
  const eventDate = new Date(dateStr);
  if (Number.isNaN(eventDate.getTime())) return '';

  const today = startOfLocalDay(new Date());
  const target = startOfLocalDay(eventDate);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return 'Idag';
  if (diffDays === 1) return 'Imorgon';
  return eventDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export function getReengagementEyebrow(stage: 'active' | 'quiet_3' | 'quiet_7' | 'quiet_14'): string {
  switch (stage) {
    case 'quiet_14':
      return 'Tillbaka in';
    case 'quiet_7':
      return 'Rytm';
    case 'quiet_3':
      return 'Tillbaka';
    default:
      return 'Nu';
  }
}

export function getReengagementContext(
  daysSinceActivity: number,
  stage: 'active' | 'quiet_3' | 'quiet_7' | 'quiet_14'
): string {
  switch (stage) {
    case 'quiet_14':
      return `${daysSinceActivity} dagar lugnt`;
    case 'quiet_7':
      return 'En vecka lugnt';
    case 'quiet_3':
      return 'Några dagar lugnt';
    default:
      return '';
  }
}

export function getActivityTimestamp(item: Record<string, any> | null | undefined): number {
  const raw = item?.created_at ?? item?.ts ?? item?.time ?? item?.t;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function isRecentActivity(
  item: Record<string, any> | null | undefined,
  maxAgeMs = 24 * 60 * 60 * 1000
): boolean {
  const ts = getActivityTimestamp(item);
  return Boolean(ts) && Date.now() - ts <= maxAgeMs;
}

export function formatActivityAge(item: Record<string, any> | null | undefined): string {
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

export function getHomeEchoSummary(item: Record<string, any>): { title: string; body: string } {
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

export function buildHomeBandStatusCards(params: {
  totalMembers: number;
  activeToday: number;
  activeNow: number | null;
  xp48h: number;
  nextEvent: { title: string; date: string } | null;
  myRank: HomeRankSummary | null;
}): HomeBandStatusCard[] {
  const { totalMembers, activeToday, activeNow, xp48h, nextEvent, myRank } = params;
  return [
    {
      kind: 'activity',
      value: `${activeToday}/${totalMembers}`,
      label: 'Aktiva',
      sub: activeNow !== null ? `${activeNow} live · ${xp48h} XP / 48h` : `${xp48h} XP / 48h`,
    },
    nextEvent ? {
      kind: 'calendar',
      value: nextEvent.date,
      label: nextEvent.title,
      sub: 'Kalender',
    } : {
      kind: 'calendar',
      value: '—',
      label: 'Tomt',
      sub: 'Kalender',
    },
    myRank ? {
      kind: 'rank',
      value: `#${myRank.pos}`,
      label: 'Position',
      sub: myRank.pos === 1 ? 'Leder' : `${myRank.gap} upp`,
    } : {
      kind: 'rank',
      value: '—',
      label: 'Position',
      sub: '—',
    },
  ];
}
