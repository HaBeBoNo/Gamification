const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY
const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID
const UPCOMING_EVENTS_TTL_MS = 60_000

type CalendarCacheEntry = {
  ts: number
  data: CalendarEvent[] | null
  promise: Promise<CalendarEvent[]> | null
}

const upcomingEventsCache = new Map<number, CalendarCacheEntry>()

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  location?: string
  description?: string
}

async function fetchUpcomingEvents(maxResults = 10): Promise<CalendarEvent[]> {
  const now = new Date().toISOString()
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`
  )
  url.searchParams.set('key', API_KEY)
  url.searchParams.set('timeMin', now)
  url.searchParams.set('maxResults', String(maxResults))
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Calendar API error: ${res.status}`)
  const data = await res.json()

  return (data.items ?? []).map((item: any) => ({
    id: item.id,
    title: item.summary || 'Ingen titel',
    start: item.start?.dateTime || item.start?.date || '',
    end: item.end?.dateTime || item.end?.date || '',
    location: item.location,
    description: item.description,
  }))
}

export async function getUpcomingEvents(maxResults = 10): Promise<CalendarEvent[]> {
  const now = Date.now()
  const cached = upcomingEventsCache.get(maxResults)

  if (cached?.data && now - cached.ts < UPCOMING_EVENTS_TTL_MS) {
    return cached.data
  }

  if (cached?.promise) {
    return cached.promise
  }

  const promise = fetchUpcomingEvents(maxResults)
    .then((data) => {
      upcomingEventsCache.set(maxResults, {
        ts: Date.now(),
        data,
        promise: null,
      })
      return data
    })
    .catch((error) => {
      if (cached?.data) {
        upcomingEventsCache.set(maxResults, {
          ts: cached.ts,
          data: cached.data,
          promise: null,
        })
        return cached.data
      }
      upcomingEventsCache.delete(maxResults)
      throw error
    })

  upcomingEventsCache.set(maxResults, {
    ts: cached?.ts || 0,
    data: cached?.data || null,
    promise,
  })

  return promise
}

export function formatEventDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('sv-SE', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export function isEventSoon(dateStr: string): boolean {
  const diff = new Date(dateStr).getTime() - Date.now()
  return diff > 0 && diff < 24 * 60 * 60 * 1000
}

export function isEventActive(start: string, end: string): boolean {
  const now = Date.now()
  return new Date(start).getTime() <= now && new Date(end).getTime() >= now
}
