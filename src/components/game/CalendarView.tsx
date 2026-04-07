import React, { useState, useEffect } from 'react'
import { MapPin, Clock, RefreshCw, CheckCircle, Check } from 'lucide-react'
import {
  getUpcomingEvents, formatEventDate, isEventSoon, isEventActive, CalendarEvent
} from '@/lib/googleCalendar'
import { S, save } from '@/state/store'
import { checkIn } from '@/hooks/useCheckIn'

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    setLoading(true)
    setError('')
    try {
      const result = await getUpcomingEvents(10)
      setEvents(result)
    } catch (e: any) {
      setError('Kunde inte hämta kalenderhändelser. Kontrollera att kalendern är publik.')
    } finally {
      setLoading(false)
    }
  }

  function isCheckedIn(eventId: string): boolean {
    return (S.checkIns ?? []).some(
      (c: any) => c.eventId === eventId && c.type !== 'rsvp' && (c.memberKey === S.me || c.member === S.me)
    )
  }

  function getCheckInCount(eventId: string): number {
    return (S.checkIns ?? []).filter((c: any) => c.eventId === eventId && c.type !== 'rsvp').length
  }

  function handleCheckIn(event: CalendarEvent) {
    if (isCheckedIn(event.id)) return
    checkIn(event.id, event.title)
  }

  // RSVP-state — lagras i S.checkIns med type: 'rsvp'
  function getRSVPCount(eventId: string): number {
    return (S.checkIns ?? []).filter(
      (c: any) => c.eventId === eventId && c.type === 'rsvp'
    ).length
  }

  function hasRSVP(eventId: string): boolean {
    return (S.checkIns ?? []).some(
      (c: any) => c.eventId === eventId && c.type === 'rsvp' && c.memberKey === S.me
    )
  }

  function handleRSVP(event: CalendarEvent) {
    if (hasRSVP(event.id)) {
      // Ta bort RSVP
      S.checkIns = (S.checkIns ?? []).filter(
        (c: any) => !(c.eventId === event.id && c.type === 'rsvp' && c.memberKey === S.me)
      )
    } else {
      // Lägg till RSVP
      if (!S.checkIns) S.checkIns = []
      S.checkIns.push({
        eventId: event.id,
        eventTitle: event.title,
        memberKey: S.me,
        type: 'rsvp',
        ts: Date.now(),
      })
    }
    save()
  }

  // Påminnelse via localStorage
  function hasReminder(eventId: string): boolean {
    const reminders = JSON.parse(localStorage.getItem('hq_reminders') || '[]')
    return reminders.some((r: any) => r.eventId === eventId && r.memberKey === S.me)
  }

  function handleReminder(event: CalendarEvent) {
    const reminders = JSON.parse(localStorage.getItem('hq_reminders') || '[]')

    if (hasReminder(event.id)) {
      // Ta bort påminnelse
      const updated = reminders.filter(
        (r: any) => !(r.eventId === event.id && r.memberKey === S.me)
      )
      localStorage.setItem('hq_reminders', JSON.stringify(updated))
    } else {
      // Lägg till påminnelse
      reminders.push({
        eventId: event.id,
        eventTitle: event.title,
        memberKey: S.me,
        eventStart: event.start,
        ts: Date.now(),
      })
      localStorage.setItem('hq_reminders', JSON.stringify(reminders))

    }
  }

  if (loading) return (
    <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      Laddar kalender...
    </div>
  )

  if (error) return (
    <div style={{ padding: 'var(--space-xl)' }}>
      <p style={{ color: 'var(--color-error, #e05555)', fontSize: 'var(--text-caption)', marginBottom: 'var(--space-md)' }}>
        {error}
      </p>
      <button onClick={loadEvents} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', padding: '8px 14px',
        color: 'var(--color-text-secondary)', fontSize: 'var(--text-caption)', cursor: 'pointer'
      }}>
        <RefreshCw size={14} /> Försök igen
      </button>
    </div>
  )

  if (events.length === 0) return (
    <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>
      Inga kommande händelser i kalendern.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', padding: 'var(--space-md) 0' }}>
      {events.map(event => {
        const soon = isEventSoon(event.start)
        const active = isEventActive(event.start, event.end)
        const checkedIn = isCheckedIn(event.id)
        const checkInCount = getCheckInCount(event.id)
        const canCheckIn = active || soon

        return (
          <div key={event.id} style={{
            background: active ? 'var(--color-primary-muted, rgba(124,106,247,0.08))' : 'var(--color-surface-elevated)',
            border: `1px solid ${active ? 'var(--color-primary)' : soon ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-body)', color: 'var(--color-text-primary)' }}>
                {active && <span style={{ color: 'var(--color-primary)', marginRight: 6, fontSize: 11 }}>● LIVE</span>}
                {soon && !active && <span style={{ color: 'var(--color-accent)', marginRight: 6, fontSize: 11 }}>● SNART</span>}
                {event.title}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)', marginBottom: event.location ? 4 : 0 }}>
              <Clock size={12} />
              {formatEventDate(event.start)}
            </div>

            {event.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)', marginBottom: 4 }}>
                <MapPin size={12} />
                {event.location}
              </div>
            )}

            {checkInCount > 0 && (
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                {checkInCount} {checkInCount === 1 ? 'member' : 'members'} incheckad{checkInCount > 1 ? 'e' : ''}
              </div>
            )}

            {canCheckIn && (
              <button
                onClick={() => handleCheckIn(event)}
                disabled={checkedIn}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                  background: checkedIn ? 'transparent' : 'var(--color-primary)',
                  color: checkedIn ? 'var(--color-accent)' : '#fff',
                  border: checkedIn ? '1px solid var(--color-accent)' : 'none',
                  borderRadius: '999px', padding: '8px 16px',
                  fontSize: 12, fontFamily: 'var(--font-ui)',
                  cursor: checkedIn ? 'default' : 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                {checkedIn
                  ? <><Check size={14} /> Incheckad (+40 XP)</>
                  : <><CheckCircle size={14} /> Checka in (+40 XP)</>}
              </button>
            )}

            {/* RSVP */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginTop: 8
            }}>
              <button
                onClick={() => handleRSVP(event)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'transparent',
                  color: hasRSVP(event.id) ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  border: `1px solid ${hasRSVP(event.id) ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: '999px', padding: '6px 14px',
                  fontSize: 12, fontFamily: 'var(--font-ui)',
                  cursor: 'pointer', touchAction: 'manipulation',
                }}
              >
                {hasRSVP(event.id) ? '✓ Jag kommer' : '+ Jag kommer'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {getRSVPCount(event.id) > 0 && (
                  <span style={{
                    fontSize: 11, color: 'var(--color-text-muted)'
                  }}>
                    {getRSVPCount(event.id)} kommer
                  </span>
                )}
                <button
                  onClick={() => handleReminder(event)}
                  style={{
                    background: 'transparent',
                    color: hasReminder(event.id) ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    border: 'none', padding: '6px',
                    cursor: 'pointer', fontSize: 16,
                    touchAction: 'manipulation',
                  }}
                  title={hasReminder(event.id) ? 'Ta bort påminnelse' : 'Sätt påminnelse'}
                >
                  {hasReminder(event.id) ? '🔔' : '🔕'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
