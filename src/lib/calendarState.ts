export type CalendarCheckInType = 'check_in' | 'rsvp' | 'decline';

export type CalendarCheckInEntry = {
  id?: string | number;
  eventId?: string;
  eventTitle?: string;
  eventStart?: string;
  memberKey?: string;
  member?: string;
  type?: CalendarCheckInType | string;
  ts?: number;
};

type CalendarCheckInSource = {
  entries?: readonly unknown[] | null;
  fallbackMemberKey?: string;
};

function asCheckInEntries(entries: readonly unknown[] | null | undefined): CalendarCheckInEntry[] {
  return Array.isArray(entries) ? (entries as CalendarCheckInEntry[]) : [];
}

export function normalizeCalendarCheckInType(
  entry: CalendarCheckInEntry | null | undefined
): CalendarCheckInType {
  return entry?.type === 'rsvp' || entry?.type === 'decline'
    ? entry.type
    : 'check_in';
}

export function getCalendarCheckInActor(
  entry: CalendarCheckInEntry | null | undefined,
  fallbackMemberKey?: string
): string {
  return String(entry?.memberKey || entry?.member || fallbackMemberKey || '');
}

export function isPresenceCheckIn(entry: CalendarCheckInEntry | null | undefined): boolean {
  return normalizeCalendarCheckInType(entry) === 'check_in';
}

export function dedupeCalendarCheckIns(
  entries: readonly unknown[] | null | undefined,
  fallbackMemberKey?: string
): CalendarCheckInEntry[] {
  const merged = new Map<string, CalendarCheckInEntry>();

  for (const rawEntry of asCheckInEntries(entries)) {
    const eventId = String(rawEntry?.eventId || '');
    const actor = getCalendarCheckInActor(rawEntry, fallbackMemberKey);
    const type = normalizeCalendarCheckInType(rawEntry);
    if (!eventId || !actor) continue;

    const key = `${actor}:${eventId}:${type}`;
    merged.set(key, {
      ...rawEntry,
      memberKey: actor,
      member: String(rawEntry?.member || actor),
      type: type === 'check_in' ? undefined : type,
    });
  }

  return [...merged.values()].sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
}

export function mergeCalendarCheckInSources(
  sources: CalendarCheckInSource[]
): CalendarCheckInEntry[] {
  return dedupeCalendarCheckIns(
    sources.flatMap((source) =>
      dedupeCalendarCheckIns(source.entries, source.fallbackMemberKey)
    )
  );
}

export function getOwnCalendarCheckIns(
  entries: readonly unknown[] | null | undefined,
  memberKey: string
): CalendarCheckInEntry[] {
  return dedupeCalendarCheckIns(entries, memberKey).filter(
    (entry) => getCalendarCheckInActor(entry, memberKey) === memberKey
  );
}

export function toggleCalendarEventResponse(
  entries: readonly unknown[] | null | undefined,
  params: {
    eventId: string;
    eventTitle: string;
    eventStart: string;
    memberKey: string;
    responseType: 'rsvp' | 'decline';
    ts?: number;
  }
): CalendarCheckInEntry[] {
  const nextEntries = dedupeCalendarCheckIns(entries, params.memberKey).filter((entry) => {
    if (entry.eventId !== params.eventId) return true;
    const actor = getCalendarCheckInActor(entry, params.memberKey);
    const type = normalizeCalendarCheckInType(entry);
    return actor !== params.memberKey || (type !== 'rsvp' && type !== 'decline');
  });

  const alreadySelected = dedupeCalendarCheckIns(entries, params.memberKey).some((entry) => (
    entry.eventId === params.eventId &&
    getCalendarCheckInActor(entry, params.memberKey) === params.memberKey &&
    normalizeCalendarCheckInType(entry) === params.responseType
  ));

  if (alreadySelected) {
    return nextEntries;
  }

  return dedupeCalendarCheckIns([
    ...nextEntries,
    {
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      eventStart: params.eventStart,
      memberKey: params.memberKey,
      member: params.memberKey,
      type: params.responseType,
      ts: params.ts ?? Date.now(),
    },
  ], params.memberKey);
}

export function addCalendarPresenceCheckIn(
  entries: readonly unknown[] | null | undefined,
  params: {
    eventId: string;
    eventTitle: string;
    memberKey: string;
    eventStart?: string;
    ts?: number;
    id?: string | number;
  }
): CalendarCheckInEntry[] {
  const deduped = dedupeCalendarCheckIns(entries, params.memberKey);
  const alreadyCheckedIn = deduped.some((entry) => (
    entry.eventId === params.eventId &&
    getCalendarCheckInActor(entry, params.memberKey) === params.memberKey &&
    isPresenceCheckIn(entry)
  ));

  if (alreadyCheckedIn) return deduped;

  return dedupeCalendarCheckIns([
    ...deduped,
    {
      id: params.id,
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      eventStart: params.eventStart,
      member: params.memberKey,
      memberKey: params.memberKey,
      ts: params.ts ?? Date.now(),
    },
  ], params.memberKey);
}

export function hasEventRSVP(
  entries: readonly unknown[] | null | undefined,
  eventId?: string,
  memberKey?: string
): boolean {
  if (!eventId || !memberKey) return false;
  return asCheckInEntries(entries).some(
    (entry) => entry?.eventId === eventId && normalizeCalendarCheckInType(entry) === 'rsvp' && entry?.memberKey === memberKey
  );
}

export function hasEventDecline(
  entries: readonly unknown[] | null | undefined,
  eventId?: string,
  memberKey?: string
): boolean {
  if (!eventId || !memberKey) return false;
  return asCheckInEntries(entries).some(
    (entry) => entry?.eventId === eventId && normalizeCalendarCheckInType(entry) === 'decline' && entry?.memberKey === memberKey
  );
}

export function getEventRSVPCount(
  entries: readonly unknown[] | null | undefined,
  eventId?: string
): number {
  if (!eventId) return 0;
  return asCheckInEntries(entries).filter(
    (entry) => entry?.eventId === eventId && normalizeCalendarCheckInType(entry) === 'rsvp'
  ).length;
}

export function getEventDeclineCount(
  entries: readonly unknown[] | null | undefined,
  eventId?: string
): number {
  if (!eventId) return 0;
  return asCheckInEntries(entries).filter(
    (entry) => entry?.eventId === eventId && normalizeCalendarCheckInType(entry) === 'decline'
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
    (entry) => (
      entry?.eventId === eventId &&
      isPresenceCheckIn(entry) &&
      getCalendarCheckInActor(entry, memberKey) === memberKey
    )
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
