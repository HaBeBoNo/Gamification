import React, { useState, useEffect } from 'react'
import { MapPin, Clock, RefreshCw, CheckCircle, Check, Bell, BellOff, Plus, X } from 'lucide-react'
import {
  getUpcomingEvents, formatEventDate, isEventSoon, isEventActive, CalendarEvent
} from '@/lib/googleCalendar'
import { S, save } from '@/state/store'
import { checkIn } from '@/hooks/useCheckIn'
import { MEMBERS } from '@/data/members'
import { getBandmateKeys, notifyMembersSignal } from '@/lib/notificationSignals'

function isPresenceCheckIn(entry: any): boolean {
  return entry?.type !== 'rsvp' && entry?.type !== 'decline'
}

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
      (c: any) => c.eventId === eventId && isPresenceCheckIn(c) && (c.memberKey === S.me || c.member === S.me)
    )
  }

  function getCheckInCount(eventId: string): number {
    return (S.checkIns ?? []).filter((c: any) => c.eventId === eventId && isPresenceCheckIn(c)).length
  }

  function handleCheckIn(event: CalendarEvent) {
    if (isCheckedIn(event.id)) return
    void checkIn(event.id, event.title)
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

  function getDeclineCount(eventId: string): number {
    return (S.checkIns ?? []).filter(
      (c: any) => c.eventId === eventId && c.type === 'decline'
    ).length
  }

  function hasDeclined(eventId: string): boolean {
    return (S.checkIns ?? []).some(
      (c: any) => c.eventId === eventId && c.type === 'decline' && c.memberKey === S.me
    )
  }

  function handleRSVP(event: CalendarEvent) {
    if (!S.me) return

    if (hasRSVP(event.id)) {
      // Ta bort RSVP
      S.checkIns = (S.checkIns ?? []).filter(
        (c: any) => !(c.eventId === event.id && c.type === 'rsvp' && c.memberKey === S.me)
      )
    } else {
      S.checkIns = (S.checkIns ?? []).filter(
        (c: any) => !(c.eventId === event.id && c.type === 'decline' && c.memberKey === S.me)
      )
      // Lägg till RSVP
      if (!S.checkIns) S.checkIns = []
      S.checkIns.push({
        eventId: event.id,
        eventTitle: event.title,
        memberKey: S.me,
        type: 'rsvp',
        eventStart: event.start,
        ts: Date.now(),
      })

      const memberName = (MEMBERS as Record<string, { name?: string }>)[S.me]?.name || S.me
      void notifyMembersSignal({
        targetMemberKeys: getBandmateKeys(S.me),
        type: 'calendar_rsvp',
        title: `${memberName} kommer`,
        body: event.title,
        dedupeKey: `calendar-rsvp:${S.me}:${event.id}`,
        payload: {
          memberId: S.me,
          eventId: event.id,
          eventTitle: event.title,
          eventStart: event.start,
        },
        push: {
          title: 'Någon kommer',
          body: `${memberName} kommer till ${event.title}`,
          excludeMember: S.me,
          url: '/',
        },
      })
    }
    save()
  }

  function handleDecline(event: CalendarEvent) {
    if (!S.me) return

    if (hasDeclined(event.id)) {
      S.checkIns = (S.checkIns ?? []).filter(
        (c: any) => !(c.eventId === event.id && c.type === 'decline' && c.memberKey === S.me)
      )
    } else {
      S.checkIns = (S.checkIns ?? []).filter(
        (c: any) => !(c.eventId === event.id && c.type === 'rsvp' && c.memberKey === S.me)
      )

      if (!S.checkIns) S.checkIns = []
      S.checkIns.push({
        eventId: event.id,
        eventTitle: event.title,
        memberKey: S.me,
        type: 'decline',
        eventStart: event.start,
        ts: Date.now(),
      })

      const memberName = (MEMBERS as Record<string, { name?: string }>)[S.me]?.name || S.me
      void notifyMembersSignal({
        targetMemberKeys: getBandmateKeys(S.me),
        type: 'calendar_decline',
        title: `${memberName} kan inte komma`,
        body: event.title,
        dedupeKey: `calendar-decline:${S.me}:${event.id}`,
        payload: {
          memberId: S.me,
          eventId: event.id,
          eventTitle: event.title,
          eventStart: event.start,
        },
        push: {
          title: 'Någon kan inte komma',
          body: `${memberName} kan inte komma till ${event.title}`,
          excludeMember: S.me,
          url: '/',
        },
      })
    }

    save()
  }

  // Påminnelser sparas i medlemdata via S.reminders
  function hasReminder(eventId: string): boolean {
    return (S.reminders ?? []).some((r: any) => r.eventId === eventId && r.memberKey === S.me)
  }

  function handleReminder(event: CalendarEvent) {
    if (!S.me) return

    if (hasReminder(event.id)) {
      // Ta bort påminnelse
      S.reminders = (S.reminders ?? []).filter(
        (r: any) => !(r.eventId === event.id && r.memberKey === S.me)
      )
    } else {
      // Lägg till påminnelse
      if (!S.reminders) S.reminders = []
      S.reminders.push({
        eventId: event.id,
        eventTitle: event.title,
        memberKey: S.me,
        eventStart: event.start,
        ts: Date.now(),
      })
    }
    save()
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
        const declineCount = getDeclineCount(event.id)
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

            {(checkInCount > 0 || getRSVPCount(event.id) > 0 || declineCount > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                {checkInCount > 0 && (
                  <span>
                    {checkInCount} {checkInCount === 1 ? 'member' : 'members'} incheckad{checkInCount > 1 ? 'e' : ''}
                  </span>
                )}
                {getRSVPCount(event.id) > 0 && (
                  <span>
                    {getRSVPCount(event.id)} kommer
                  </span>
                )}
                {declineCount > 0 && (
                  <span>
                    {declineCount} kan inte
                  </span>
                )}
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
              justifyContent: 'space-between', marginTop: 8, gap: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  }}>
                  {hasRSVP(event.id) ? <><Check size={13} /> Jag kommer</> : <><Plus size={13} /> Jag kommer</>}
                </button>
                <button
                  onClick={() => handleDecline(event)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'transparent',
                    color: hasDeclined(event.id) ? 'var(--color-error, #e05555)' : 'var(--color-text-muted)',
                    border: `1px solid ${hasDeclined(event.id) ? 'var(--color-error, #e05555)' : 'var(--color-border)'}`,
                    borderRadius: '999px', padding: '6px 14px',
                    fontSize: 12, fontFamily: 'var(--font-ui)',
                    cursor: 'pointer', touchAction: 'manipulation',
                  }}
                >
                  {hasDeclined(event.id) ? <><X size={13} /> Kan inte</> : 'Kan inte'}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
                  {hasReminder(event.id) ? <Bell size={16} strokeWidth={1.9} /> : <BellOff size={16} strokeWidth={1.9} />}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
