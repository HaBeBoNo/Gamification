export type CalendarCheckInEntry = {
  eventId?: string;
  memberKey?: string;
  member?: string;
  type?: string;
};

function asCheckInEntries(entries: readonly unknown[] | null | undefined): CalendarCheckInEntry[] {
  return Array.isArray(entries) ? (entries as CalendarCheckInEntry[]) : [];
}

export function isPresenceCheckIn(entry: CalendarCheckInEntry | null | undefined): boolean {
  return entry?.type !== 'rsvp' && entry?.type !== 'decline';
}

export function hasEventRSVP(
  entries: readonly unknown[] | null | undefined,
  eventId?: string,
  memberKey?: string
): boolean {
  if (!eventId || !memberKey) return false;
  return asCheckInEntries(entries).some(
    (entry) => entry?.eventId === eventId && entry?.type === 'rsvp' && entry?.memberKey === memberKey
  );
}

export function hasEventDecline(
  entries: readonly unknown[] | null | undefined,
  eventId?: string,
  memberKey?: string
): boolean {
  if (!eventId || !memberKey) return false;
  return asCheckInEntries(entries).some(
    (entry) => entry?.eventId === eventId && entry?.type === 'decline' && entry?.memberKey === memberKey
  );
}

export function getEventRSVPCount(
  entries: readonly unknown[] | null | undefined,
  eventId?: string
): number {
  if (!eventId) return 0;
  return asCheckInEntries(entries).filter(
    (entry) => entry?.eventId === eventId && entry?.type === 'rsvp'
  ).length;
}

export function getEventDeclineCount(
  entries: readonly unknown[] | null | undefined,
  eventId?: string
): number {
  if (!eventId) return 0;
  return asCheckInEntries(entries).filter(
    (entry) => entry?.eventId === eventId && entry?.type === 'decline'
  ).length;
}

export function getEventCheckInCount(
  entries: readonly unknown[] | null | undefined,
  eventId?: string
): number {
  if (!eventId) return 0;
  return asCheckInEntries(entries).filter(
    (entry) => entry?.eventId === eventId && isPresenceCheckIn(entry)
  ).length;
}

export function isCheckedInByMember(
  entries: readonly unknown[] | null | undefined,
  eventId?: string,
  memberKey?: string
): boolean {
  if (!eventId || !memberKey) return false;
  return asCheckInEntries(entries).some(
    (entry) => entry?.eventId === eventId && isPresenceCheckIn(entry) && (entry?.memberKey === memberKey || entry?.member === memberKey)
  );
}

export function getCalendarEventParticipationState(
  entries: readonly unknown[] | null | undefined,
  eventId?: string,
  memberKey?: string
) {
  const hasRsvp = hasEventRSVP(entries, eventId, memberKey);
  const hasDeclined = hasEventDecline(entries, eventId, memberKey);
  const checkedIn = isCheckedInByMember(entries, eventId, memberKey);

  return {
    hasRsvp,
    hasDeclined,
    hasResponded: hasRsvp || hasDeclined,
    checkedIn,
    rsvpCount: getEventRSVPCount(entries, eventId),
    declineCount: getEventDeclineCount(entries, eventId),
    checkInCount: getEventCheckInCount(entries, eventId),
  };
}
