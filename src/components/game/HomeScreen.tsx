import React, { useState, useEffect } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import ActivityFeed from './ActivityFeed';
import { supabase } from '@/lib/supabase';
import { getUpcomingEvents } from '@/lib/googleCalendar';

// ── HeroCard ────────────────────────────────────────────────────────
function HeroCard() {
  const memberKey = S.me!;
  const member = (MEMBERS as Record<string, any>)[memberKey];
  const char = (S.chars as Record<string, any>)?.[memberKey];
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
  const [xp48h, setXp48h] = useState(0);
  const [nextEvent, setNextEvent] = useState<{ title: string; date: string } | null>(null);
  const [myRank, setMyRank] = useState<{ pos: number; gap: number; above: string } | null>(null);

  useEffect(() => {
    async function loadPulse() {
      try {
        const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from('activity_feed')
          .select('who, xp, created_at')
          .gte('created_at', since);
        if (!data) return;
        const todayStr = new Date().toDateString();
        const active = new Set(
          data.filter((i: any) => new Date(i.created_at).toDateString() === todayStr).map((i: any) => i.who)
        );
        setActiveToday(active.size);
        setXp48h(data.reduce((s: number, i: any) => s + (i.xp ?? 0), 0));
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
  }, []);

  const cards = [
    {
      icon: '⚡',
      value: `${activeToday}/8`,
      label: 'Aktiva idag',
      sub: `${xp48h} XP · 48h`,
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

// ── FeaturedQuest ───────────────────────────────────────────────────
function FeaturedQuest({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const memberKey = S.me;
  // Först: mina egna ej slutförda quests. Fallback: vilken som helst ej slutförd.
  const myQuest = (S.quests ?? []).find((q: any) => !q.done && q.owner === memberKey);
  const anyQuest = (S.quests ?? []).find((q: any) => !q.done);
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

// ── HomeScreen ──────────────────────────────────────────────────────
interface HomeScreenProps {
  rerender: () => void;
  onMetricClick?: () => void;
  onNavigate?: (tab: string) => void;
}

export function HomeScreen({ onNavigate }: HomeScreenProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-md)',
      paddingBottom: 'calc(var(--nav-height, 80px) + var(--space-xl))',
    }}>
      <HeroCard />
      <BandStatusRow />
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
