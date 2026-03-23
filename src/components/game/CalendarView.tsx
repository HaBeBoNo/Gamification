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
    S.feed.unshift({ who: S.me, action: `checkade in på \