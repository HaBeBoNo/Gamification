/**
 * googleCalendar.ts
 * Google Calendar REST API helpers (v3).
 * Fetches events from the band's shared calendar.
 * Calendar ID is read from VITE_GOOGLE_CALENDAR_ID env var (falls back to 'primary').
 */

import { getAuthHeader } from './googleAuth';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// Use the band's shared calendar ID if set, otherwise fall back to the user's primary calendar
const BAND_CALENDAR_ID =
  import.meta.env.VITE_GOOGLE_CALENDAR_ID || 'primary';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
  colorId?: string;
}

export interface NewEventInput {
  title: string;
  date: string;        // ISO date string (YYYY-MM-DD) or dateTime
  endDate?: string;    // ISO — if omitted, defaults to 1 hour after start
  description?: string;
  location?: string;
  allDay?: boolean;
}

/**
 * Fetch events between timeMin and timeMax.
 * @param timeMin - ISO 8601 datetime string (e.g. new Date().toISOString())
 * @param timeMax - ISO 8601 datetime string
 */
export async function getEvents(
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '25',
  });

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(BAND_CALENDAR_ID)}/events?${params}`,
    { headers: { Authorization: getAuthHeader() } }
  );

  if (!res.ok) throw new Error(`Calendar getEvents failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.items ?? [];
}

/**
 * Fetch upcoming events (from now, next 90 days).
 */
export async function getUpcomingEvents(): Promise<CalendarEvent[]> {
  const now = new Date();
  const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  return getEvents(now.toISOString(), future.toISOString());
}

/**
 * Create a new event in the band calendar.
 */
export async function createEvent(
  input: NewEventInput
): Promise<CalendarEvent> {
  const { title, date, endDate, description, location, allDay } = input;

  let startObj: { dateTime?: string; date?: string; timeZone?: string };
  let endObj: { dateTime?: string; date?: string; timeZone?: string };

  if (allDay) {
    // All-day event: use 'date' format YYYY-MM-DD
    const dateStr = date.split('T')[0];
    const endDateStr = endDate ? endDate.split('T')[0] : dateStr;
    startObj = { date: dateStr };
    endObj = { date: endDateStr };
  } else {
    const startDt = new Date(date);
    const endDt = endDate
      ? new Date(endDate)
      : new Date(startDt.getTime() + 60 * 60 * 1000); // +1 hour default
    startObj = { dateTime: startDt.toISOString(), timeZone: 'Europe/Stockholm' };
    endObj = { dateTime: endDt.toISOString(), timeZone: 'Europe/Stockholm' };
  }

  const body: Record<string, unknown> = { summary: title, start: startObj, end: endObj };
  if (description) body.description = description;
  if (location) body.location = location;

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(BAND_CALENDAR_ID)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) throw new Error(`Calendar createEvent failed: ${res.status} ${res.statusText}`);
  return res.json();
}

/** Delete an event by ID */
export async function deleteEvent(eventId: string): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(BAND_CALENDAR_ID)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: getAuthHeader() },
    }
  );
  if (!res.ok && res.status !== 204)
    throw new Error(`Calendar deleteEvent failed: ${res.status}`);
}

/** Format a CalendarEvent start date/time to a Swedish display string */
export function formatEventDate(event: CalendarEvent): string {
  const raw = event.start.dateTime ?? event.start.date;
  if (!raw) return '—';
  const d = new Date(raw);
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

/** Format event time (HH:MM) or 'Heldag' */
export function formatEventTime(event: CalendarEvent): string {
  if (event.start.date && !event.start.dateTime) return 'Heldag';
  const raw = event.start.dateTime;
  if (!raw) return '—';
  const d = new Date(raw);
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}
