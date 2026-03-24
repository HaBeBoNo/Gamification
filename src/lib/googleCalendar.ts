import { getGoogleAccessToken } from './googleAuth';

const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID ||
  '7b6c8d54ffb5de2adaf59ee68feceb14266a70dac26279e78d037549182dc452@group.calendar.google.com';

async function getAccessToken(): Promise<string | null> {
  return getGoogleAccessToken();
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  isAllDay: boolean;
}

export async function getUpcomingEvents(maxResults = 10): Promise<CalendarEvent[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const now = new Date().toISOString();
  const params = new URLSearchParams({
    calendarId: CALENDAR_ID,
    timeMin: now,
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return [];
    const data = await res.json();

    return (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.summary || 'Namnlöst event',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || '',
      location: item.location || '',
      description: item.description || '',
      isAllDay: !item.start?.dateTime,
    }));
  } catch {
    return [];
  }
}

export function formatEventDate(dateStr: string, isAllDay: boolean): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isAllDay) {
    return date.toLocaleDateString('sv-SE', {
      weekday: 'short', day: 'numeric', month: 'short'
    });
  }
  return date.toLocaleDateString('sv-SE', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });
}

export function isEventSoon(dateStr: string): boolean {
  const event = new Date(dateStr);
  const now = new Date();
  const diff = event.getTime() - now.getTime();
  return diff >= 0 && diff <= 30 * 60 * 1000; // inom 30 minuter
}

export function isEventActive(start: string, end: string): boolean {
  const now = new Date();
  return new Date(start) <= now && now <= new Date(end);
}