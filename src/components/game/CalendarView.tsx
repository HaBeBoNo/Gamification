```tsx
import React, { useState, useEffect } from 'react';
import { MapPin, Clock, CheckCircle, Check, RefreshCw } from 'lucide-react';
import { getUpcomingEvents, formatEventDate, isEventSoon, isEventActive, CalendarEvent } from '@/lib/googleCalendar';
import { S, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { addNotifToAll } from '@/state/notifications';

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    setLoading(true);
    setError('');
    try {
      const result = await getUpcomingEvents(10);
      setEvents(result);
    } catch {
      setError('Kunde inte hämta kalenderhändelser.');
    } finally {
      setLoading(false);
    }
  }

  function isCheckedIn(eventId: string): boolean {
    return (S.checkIns || []).some((c: any) => c.eventId === eventId && c.member === S.me);
  }

  function handleCheckIn(event: CalendarEvent) {
    if (isCheckedIn(event.id)) return;
    if (!S.checkIns) S.checkIns = [];
    S.checkIns.push({ id: Date.now(), eventId: event.id, eventTitle: event.title, member: S.me, ts: Date.now() });
    const xp = 40;
    const char = S.chars[S.me];
    if (char) { char.xp = (char.xp || 0) + xp; char.totalXp = (char.totalXp || 0) + xp; }
    const memberName = (MEMBERS as any)[S.me]?.name || S.me;
    S.feed.unshift({ who: S.me, action: `checkade in på "${event.title}" 📍`, xp, time: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) });
    addNotifToAll({ id: Date.now() + Math.random(), type: 'checkin', title: `${memberName} checkade in på "${event.title}" 📍`, body: '', memberKey: S.me, ts: Date.now(), read: false });
    save();
  }

  function getCheckInNames(eventId: string): string[] {
    return (S.checkIns || []).filter((c: any) => c.eventId === eventId).map((c: any) => (MEMBERS as any)[c.member]?.name || c.member);
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: 'var(--color-text-muted)', fontSize: 13, fontFamily: 'var(--font-ui)' }}>Hämtar händelser...</div>;

  if (error) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>{error}</div>
      <button onClick={loadEvents} style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '999px', padding: '10px 20px', fontSize: 13, fontFamily: 'var(--font-ui)', cursor: 'pointer' }}>Försök igen</button>
    </div>
  );

  if (events.length === 0) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Inga kommande händelser.</div>;

  return (
    <div style={{ padding: '0 16px 100px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 12px' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--color-text-muted)', fontFamily: 'var(--font-ui)' }}>KOMMANDE HÄNDELSER</div>
        <button onClick={loadEvents} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4, touchAction: 'manipulation' }}><RefreshCw size={16} /></button>
      </div>

      {events.map(event => {
        const checkedIn = isCheckedIn(event.id);
        const active = isEventActive(event.start, event.end);
        const soon = isEventSoon(event.start);
        const canCheckIn = active || soon;
        const checkInNames = getCheckInNames(event.id);

        return (
          <div key={event.id} style={{ background: 'var(--color-surface)', border: `1px solid ${active ? 'var(--color-primary)40' : 'var(--color-border)'}`, borderRadius: 12, padding: '16px', marginBottom: 12, position: 'relative' }}>
            {active && <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, letterSpacing: '0.1em', background: 'var(--color-primary)', color: '#fff', borderRadius: '999px', padding: '3px 8px', fontFamily: 'var(--font-ui)' }}>PÅGÅR NU</div>}
            {soon && !active && <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, letterSpacing: '0.1em', background: '#f39c12', color: '#fff', borderRadius: '999px', padding: '3px 8px', fontFamily: 'var(--font-ui)' }}>SNART</div>}

            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8, paddingRight: 80 }}>{event.title}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Clock size={12} color='var(--color-text-muted)' />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{formatEventDate(event.start, event.isAllDay)}</span>
            </div>

            {event.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <MapPin size={12} color='var(--color-text-muted)' />
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{event.location}</span>
              </div>
            )}

            {checkInNames.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                {checkInNames.join(', ')} incheckad{checkInNames.length > 1 ? 'e' : ''}
              </div>
            )}

            {canCheckIn && (
              <button onClick={() => handleCheckIn(event)} disabled={checkedIn} style={{ display: 'flex', alignItems: 'center', gap: 6, background: checkedIn ? 'var(--color-accent)20' : 'var(--color-primary)', color: checkedIn ? 'var(--color-accent)' : '#fff', border: 'none', borderRadius: '999px', padding: '8px 16px', fontSize: 12, fontFamily: 'var(--font-ui)', cursor: checkedIn ? 'default' : 'pointer', touchAction: 'manipulation', marginTop: 4 }}>
                {checkedIn ? <><Check size={14} /> Incheckad (+40 XP)</> : <><CheckCircle size={14} /> Checka in (+40 XP)</>}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Commit-meddelande:**
```
Add CalendarView component — shared band calendar with check-in and XP
```
