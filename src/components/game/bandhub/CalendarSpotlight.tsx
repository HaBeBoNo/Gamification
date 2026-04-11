import { CalendarDays, CircleOff, Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { S } from '@/state/store';
import { getUpcomingEvents, isEventActive } from '@/lib/googleCalendar';
import { isCalendarResponseNeeded } from '@/lib/reengagement';
import { getCalendarEventParticipationState } from '@/lib/calendarState';
import { SectionEyebrow } from './SectionEyebrow';
import { StatCard } from './StatCard';
import { emptyCardStyle } from './styles';

export function CalendarSpotlight() {
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

    void loadEvents();
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
              value={nextLabel}
              detail={nextEvent ? `${nextEvent.title} · ${nextTime}` : 'Tomt'}
            />
            <StatCard
              icon={<Clock3 size={15} />}
              label="Kommer"
              value={nextEvent ? String(rsvpCount) : '0'}
              detail={nextEvent ? (hasRsvp ? 'Med' : hasDeclined ? 'Kan inte' : 'Väntar') : '—'}
            />
            <StatCard
              icon={<CircleOff size={15} />}
              label="Kan inte"
              value={nextEvent ? String(declineCount) : '0'}
              detail={nextEvent ? 'Frånvaro' : '—'}
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
                  ? `${rsvpCount} kommer${declineCount > 0 ? ` · ${declineCount} kan inte` : ''}`
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
