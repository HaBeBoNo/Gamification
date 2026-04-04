import React, { useState, useEffect } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { BandPulse } from './BandPulse';
import AICoach from './AICoach';
import ActivityFeed from './ActivityFeed';
import MetricsBar from './MetricsBar';
import { getUpcomingEvents, CalendarEvent } from '@/lib/googleCalendar';

// ── SectionHeader ───────────────────────────────────────────────────
function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 'var(--space-sm) var(--space-md) 0',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        {label}
      </span>
    </div>
  );
}

// ── HomeHeader ──────────────────────────────────────────────────────
function HomeHeader() {
  const memberDef = MEMBERS[S.me!];
  const level = (S.chars as any)?.[S.me!]?.level ?? 1;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-sm)',
      padding: 'var(--space-lg) var(--space-md)',
      background: 'linear-gradient(180deg, var(--color-surface-elevated) 0%, transparent 100%)',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'var(--color-surface-elevated)',
        border: '2px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MemberIcon id={S.me!} size={64} />
      </div>

      {/* LVL badge */}
      <div style={{
        background: 'var(--color-primary)',
        color: 'var(--color-surface)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-micro)',
        borderRadius: 'var(--radius-pill)',
        padding: '2px 8px',
        letterSpacing: '0.06em',
        lineHeight: 1.4,
      }}>
        LVL {level}
      </div>

      <p style={{
        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)', letterSpacing: '0.1em',
        textTransform: 'uppercase', margin: 0,
      }}>
        Välkommen till Headquarters
      </p>

      <h1 style={{
        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-heading)',
        color: 'var(--color-text)', margin: 0, letterSpacing: '0.05em',
      }}>
        SEKTIONEN HQ
      </h1>

      <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', margin: 0 }}>
        {memberDef?.role} · <span style={{
          color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-micro)', textTransform: 'uppercase',
        }}>{memberDef?.roleType}</span>
      </p>
    </div>
  );
}

// ── UpcomingEvents ──────────────────────────────────────────────────
function formatEventDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const diff = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Idag';
  if (diff === 1) return 'Imorgon';
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function UpcomingEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    getUpcomingEvents(3)
      .then(setEvents)
      .catch(() => {});
  }, []);

  return (
    <div style={{
      margin: '0 var(--space-md) var(--space-md)',
      background: 'var(--color-surface-elevated)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      {events.length === 0 ? (
        <div style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
            Inga kommande events
          </span>
        </div>
      ) : (
        events.slice(0, 3).map(event => (
          <div key={event.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-sm) var(--space-md)',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <span style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)' }}>
              {event.title}
            </span>
            <span style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              {formatEventDate(event.start)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ── HomeScreen ──────────────────────────────────────────────────────
interface HomeScreenProps {
  rerender: () => void;
  onMetricClick?: () => void;
}

export function HomeScreen({ rerender, onMetricClick }: HomeScreenProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
      paddingBottom: 'calc(var(--nav-height, 80px) + var(--space-xl))',
    }}>
      <HomeHeader />

      <MetricsBar onMetricClick={onMetricClick} />

      <SectionHeader label="Bandpuls" />
      <BandPulse />

      <SectionHeader label="Kommande" />
      <UpcomingEvents />

      <SectionHeader label="Coach" />
      <div style={{ margin: '0 0 var(--space-md)' }}>
        <AICoach rerender={rerender} />
      </div>

      <SectionHeader label="Aktivitet" />
      <ActivityFeed hideHeader />
    </div>
  );
}

export default HomeScreen;
