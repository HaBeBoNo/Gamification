import { CalendarDays, CircleOff, Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { S, useGameStore } from '@/state/store';
import { fireAndForget } from '@/lib/async';
import { getUpcomingEvents, isEventActive } from '@/lib/googleCalendar';
import { isCalendarResponseNeeded } from '@/lib/reengagement';
import { getCalendarEventParticipationState } from '@/lib/calendarState';
import { SectionEyebrow } from './SectionEyebrow';
import { StatCard } from './StatCard';
import { emptyCardStyle } from './styles';

function getCompactCalendarDateLabel(dateString?: string): string {
  if (!dateString) return '—';

  const eventDate = new Date(dateString);
  if (Number.isNaN(eventDate.getTime())) return '—';

  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const eventStart = new Date(eventDate);
  eventStart.setHours(0, 0, 0, 0);

  const diffDays = Math.round((eventStart.getTime() - todayStart.getTime()) / 86400000);

  if (diffDays === 0) return 'Idag';
  if (diffDays === 1) return 'Imorgon';

  return eventDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

export function CalendarSpotlight() {
  useGameStore((state) => state.tick);
  const [events, setEvents] = useState<Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      try {
        const upcoming = await getUpcomingEvents(3);
        if (!cancelled) setEvents(upcoming);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fireAndForget(loadEvents(), 'load calendar spotlight');
    return () => {
      cancelled = true;
    };
  }, []);

  const nextEvent = events[0] || null;
  const participation = nextEvent
    ? getCalendarEventParticipationState(S.checkIns, nextEvent.id, S.me || undefined)
    : null;
  const hasRsvp = participation?.hasRsvp || false;
  const hasDeclined = participation?.hasDeclined || false;
  const rsvpCount = participation?.rsvpCount || 0;
  const declineCount = participation?.declineCount || 0;
  const checkInCount = participation?.checkInCount || 0;
  const active = nextEvent ? isEventActive(nextEvent.start, nextEvent.end) : false;
  const needsResponse = nextEvent ? isCalendarResponseNeeded(nextEvent.start, Boolean(participation?.hasResponded)) : false;
  const nextCompactLabel = nextEvent
    ? getCompactCalendarDateLabel(nextEvent.start)
    : '—';
  const nextLabel = nextEvent
    ? new Date(nextEvent.start).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';
  const nextTime = nextEvent
    ? new Date(nextEvent.start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <section style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionEyebrow title="Kalenderfokus" />

      {loading ? (
        <div style={emptyCardStyle}>Läser in...</div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10,
            marginBottom: 12,
          }}>
            <StatCard
              icon={<CalendarDays size={15} />}
              label="Nästa"
              value={nextCompactLabel}
              detail={nextEvent ? nextTime : 'Tomt'}
            />
            <StatCard
              icon={<Clock3 size={15} />}
              label="Ja-svar"
              value={nextEvent ? String(rsvpCount) : '0'}
              detail={nextEvent ? (rsvpCount > 0 ? 'Svarat ja' : 'Inga ännu') : '—'}
            />
            <StatCard
              icon={<CircleOff size={15} />}
              label="Nej-svar"
              value={nextEvent ? String(declineCount) : '0'}
              detail={nextEvent ? (declineCount > 0 ? 'Svarat nej' : 'Inga ännu') : '—'}
            />
          </div>

          <div style={{
            background: active || needsResponse
              ? 'color-mix(in srgb, var(--color-primary-muted) 42%, var(--color-surface-elevated))'
              : 'var(--color-surface-elevated)',
            border: `1px solid ${active || needsResponse ? 'color-mix(in srgb, var(--color-primary) 35%, var(--color-border))' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-card)',
            padding: '16px 16px',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              color: active || needsResponse ? 'var(--color-primary)' : 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}>
              {active ? 'Live nu' : needsResponse ? 'Svar behövs' : nextEvent ? 'Nästa uppe' : 'Tomt just nu'}
            </div>
            <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text)', fontWeight: 600, marginBottom: 6 }}>
              {active
                ? nextEvent?.title
                : needsResponse
                  ? nextEvent?.title
                  : nextEvent
                    ? nextEvent.title
                    : 'Kalendern är lugn'}
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
              {active
                ? `${checkInCount} incheckad${checkInCount === 1 ? '' : 'e'}`
                : needsResponse
                  ? `${rsvpCount} ja-svar${declineCount > 0 ? ` · ${declineCount} nej-svar` : ''}`
                  : nextEvent
                    ? `${nextLabel} · ${nextTime}`
                    : 'Inget nära'}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
