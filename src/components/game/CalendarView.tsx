import React, { useState, useEffect } from 'react'
import { MapPin, Clock, RefreshCw, CheckCircle, Check, Bell, BellOff, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  getUpcomingEvents, formatEventDate, isEventSoon, isEventActive, CalendarEvent
} from '@/lib/googleCalendar'
import { S, save } from '@/state/store'
import { checkIn } from '@/hooks/useCheckIn'
import { MEMBERS } from '@/data/members'
import { getBandmateKeys, notifyMembersSignal } from '@/lib/notificationSignals'
import {
  getCalendarEventParticipationState,
  toggleCalendarEventResponse,
} from '@/lib/calendarState'

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  useEffect(() => { loadEvents() }, [])

  useEffect(() => {
    if (events.length === 0) return
    if (expandedEventId && events.some((event) => event.id === expandedEventId)) return

    const nextExpanded = events.find((event) => {
      const participation = getCalendarEventParticipationState(S.checkIns, event.id, S.me || undefined)
      return isEventActive(event.start, event.end) || (!participation.hasRsvp && !participation.hasDeclined)
    }) || events[0]

    setExpandedEventId(nextExpanded.id)
  }, [events, expandedEventId])

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

  function handleCheckIn(event: CalendarEvent) {
    if (getCalendarEventParticipationState(S.checkIns, event.id, S.me || undefined).checkedIn) return
    void checkIn(event.id, event.title)
  }

  function handleRSVP(event: CalendarEvent) {
    if (!S.me) return

    const currentLength = S.checkIns.length
    S.checkIns = toggleCalendarEventResponse(S.checkIns, {
      eventId: event.id,
      eventTitle: event.title,
      eventStart: event.start,
      memberKey: S.me,
      responseType: 'rsvp',
      ts: Date.now(),
    })

    if (S.checkIns.length > currentLength) {
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

    const currentLength = S.checkIns.length
    S.checkIns = toggleCalendarEventResponse(S.checkIns, {
      eventId: event.id,
      eventTitle: event.title,
      eventStart: event.start,
      memberKey: S.me,
      responseType: 'decline',
      ts: Date.now(),
    })

    if (S.checkIns.length > currentLength) {
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
        const participation = getCalendarEventParticipationState(S.checkIns, event.id, S.me || undefined)
        const checkedIn = participation.checkedIn
        const checkInCount = participation.checkInCount
        const declineCount = participation.declineCount
        const rsvpCount = participation.rsvpCount
        const hasRsvp = participation.hasRsvp
        const hasDeclined = participation.hasDeclined
        const canCheckIn = active
        const isExpanded = expandedEventId === event.id
        const personalStatus = checkedIn
          ? 'Du är incheckad'
          : hasRsvp
            ? 'Du kommer'
            : hasDeclined
              ? 'Du kan inte'
              : hasReminder(event.id)
                ? 'Påminnelse på'
                : active
                  ? 'Live nu'
                  : 'Öppna'

        return (
          <div key={event.id} style={{
            background: active ? 'var(--color-primary-muted, rgba(124,106,247,0.08))' : 'var(--color-surface-elevated)',
            border: `1px solid ${active ? 'var(--color-primary)' : soon ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: '18px',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => setExpandedEventId((current) => current === event.id ? null : event.id)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '16px 16px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 10,
                textAlign: 'left',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: 6,
                  }}>
                    {active && <span style={{ color: 'var(--color-primary)', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>● LIVE</span>}
                    {soon && !active && <span style={{ color: 'var(--color-accent)', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>● SNART</span>}
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      minHeight: 26,
                      padding: '0 10px',
                      borderRadius: '999px',
                      background: checkedIn || hasRsvp
                        ? 'var(--color-primary-muted)'
                        : hasDeclined
                          ? 'color-mix(in srgb, var(--color-error, #e05555) 16%, transparent)'
                          : 'var(--color-surface)',
                      border: `1px solid ${checkedIn || hasRsvp
                        ? 'var(--color-primary)'
                        : hasDeclined
                          ? 'var(--color-error, #e05555)'
                          : 'var(--color-border)'}`,
                      color: checkedIn || hasRsvp
                        ? 'var(--color-primary)'
                        : hasDeclined
                          ? 'var(--color-error, #e05555)'
                          : 'var(--color-text-muted)',
                      fontSize: 'var(--text-micro)',
                      fontFamily: 'var(--font-ui)',
                      letterSpacing: '0.04em',
                    }}>
                      {personalStatus}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', lineHeight: 1.35 }}>
                    {event.title}
                  </div>
                </div>
                <div style={{
                  width: 32,
                  minHeight: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-muted)',
                  flexShrink: 0,
                }}>
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>
                <Clock size={12} />
                {formatEventDate(event.start)}
              </div>

              {(checkInCount > 0 || rsvpCount > 0 || declineCount > 0) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {checkInCount > 0 && <span>{checkInCount} incheckade</span>}
                  {rsvpCount > 0 && <span>{rsvpCount} kommer</span>}
                  {declineCount > 0 && <span>{declineCount} kan inte</span>}
                </div>
              )}
            </button>

            {isExpanded && (
              <div style={{
                padding: '0 16px 16px',
                borderTop: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                {event.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)', paddingTop: 14 }}>
                    <MapPin size={12} />
                    {event.location}
                  </div>
                )}

                {!event.location && <div style={{ paddingTop: 14 }} />}

                {canCheckIn && (
                  <button
                    onClick={() => handleCheckIn(event)}
                    disabled={checkedIn}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      minHeight: 44,
                      background: checkedIn ? 'transparent' : 'var(--color-primary)',
                      color: checkedIn ? 'var(--color-accent)' : '#fff',
                      border: checkedIn ? '1px solid var(--color-accent)' : 'none',
                      borderRadius: '999px',
                      padding: '0 16px',
                      fontSize: 12,
                      fontFamily: 'var(--font-ui)',
                      cursor: checkedIn ? 'default' : 'pointer',
                      touchAction: 'manipulation',
                    }}
                  >
                    {checkedIn
                      ? <><Check size={14} /> Incheckad (+40 XP)</>
                      : <><CheckCircle size={14} /> Checka in (+40 XP)</>}
                  </button>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}>
                  <button
                    onClick={() => handleRSVP(event)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      minHeight: 40,
                      background: hasRsvp ? 'var(--color-primary-muted)' : 'transparent',
                      color: hasRsvp ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      border: `1px solid ${hasRsvp ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderRadius: '999px',
                      padding: '0 14px',
                      fontSize: 12,
                      fontFamily: 'var(--font-ui)',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}>
                    {hasRsvp ? <><Check size={13} /> Jag kommer</> : <><Plus size={13} /> Jag kommer</>}
                  </button>
                  <button
                    onClick={() => handleDecline(event)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      minHeight: 40,
                      background: hasDeclined ? 'color-mix(in srgb, var(--color-error, #e05555) 16%, transparent)' : 'transparent',
                      color: hasDeclined ? 'var(--color-error, #e05555)' : 'var(--color-text-muted)',
                      border: `1px solid ${hasDeclined ? 'var(--color-error, #e05555)' : 'var(--color-border)'}`,
                      borderRadius: '999px',
                      padding: '0 14px',
                      fontSize: 12,
                      fontFamily: 'var(--font-ui)',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                  >
                    {hasDeclined ? <><X size={13} /> Kan inte</> : 'Kan inte'}
                  </button>
                  <button
                    onClick={() => handleReminder(event)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      minHeight: 40,
                      background: hasReminder(event.id) ? 'var(--color-primary-muted)' : 'transparent',
                      color: hasReminder(event.id) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      border: `1px solid ${hasReminder(event.id) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderRadius: '999px',
                      padding: '0 14px',
                      fontSize: 12,
                      fontFamily: 'var(--font-ui)',
                      cursor: 'pointer',
                      touchAction: 'manipulation',
                    }}
                    title={hasReminder(event.id) ? 'Ta bort påminnelse' : 'Sätt påminnelse'}
                  >
                    {hasReminder(event.id)
                      ? <><Bell size={14} strokeWidth={1.9} /> Påminnelse på</>
                      : <><BellOff size={14} strokeWidth={1.9} /> Påminn mig</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
