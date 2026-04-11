import { describe, expect, it } from 'vitest';
import {
  addCalendarPresenceCheckIn,
  dedupeCalendarCheckIns,
  getCalendarEventParticipationState,
  getOwnCalendarCheckIns,
  getEventCheckInCount,
  getEventDeclineCount,
  getEventRSVPCount,
  hasEventDecline,
  hasEventRSVP,
  isCheckedInByMember,
  isPresenceCheckIn,
  toggleCalendarEventResponse,
} from './calendarState';

const entries = [
  { eventId: 'rep-1', memberKey: 'hannes', type: 'rsvp' },
  { eventId: 'rep-1', memberKey: 'niklas', type: 'decline' },
  { eventId: 'rep-1', memberKey: 'ludvig', type: 'check_in' },
  { eventId: 'rep-1', member: 'nisse', type: 'check_in' },
  { eventId: 'rep-2', memberKey: 'hannes', type: 'rsvp' },
];

describe('calendarState', () => {
  it('treats only non-rsvp/non-decline entries as presence check-ins', () => {
    expect(isPresenceCheckIn({ type: 'check_in' })).toBe(true);
    expect(isPresenceCheckIn({ type: 'rsvp' })).toBe(false);
    expect(isPresenceCheckIn({ type: 'decline' })).toBe(false);
  });

  it('detects personal response state correctly', () => {
    expect(hasEventRSVP(entries, 'rep-1', 'hannes')).toBe(true);
    expect(hasEventDecline(entries, 'rep-1', 'niklas')).toBe(true);
    expect(hasEventRSVP(entries, 'rep-1', 'niklas')).toBe(false);
  });

  it('counts event participation buckets consistently', () => {
    expect(getEventRSVPCount(entries, 'rep-1')).toBe(1);
    expect(getEventDeclineCount(entries, 'rep-1')).toBe(1);
    expect(getEventCheckInCount(entries, 'rep-1')).toBe(2);
  });

  it('supports checked-in state from both memberKey and legacy member fields', () => {
    expect(isCheckedInByMember(entries, 'rep-1', 'ludvig')).toBe(true);
    expect(isCheckedInByMember(entries, 'rep-1', 'nisse')).toBe(true);
    expect(isCheckedInByMember(entries, 'rep-1', 'hannes')).toBe(false);
  });

  it('returns a single coherent participation snapshot', () => {
    expect(getCalendarEventParticipationState(entries, 'rep-1', 'niklas')).toEqual({
      hasRsvp: false,
      hasDeclined: true,
      hasResponded: true,
      checkedIn: false,
      rsvpCount: 1,
      declineCount: 1,
      checkInCount: 2,
    });
  });

  it('dedupes and normalizes legacy entries into a stable check-in list', () => {
    expect(dedupeCalendarCheckIns([
      { eventId: 'rep-1', member: 'hannes', ts: 1 },
      { eventId: 'rep-1', memberKey: 'hannes', ts: 2 },
      { eventId: 'rep-1', memberKey: 'hannes', type: 'rsvp', ts: 3 },
      { eventId: 'rep-1', memberKey: 'hannes', type: 'rsvp', ts: 4 },
    ], 'hannes')).toEqual([
      { eventId: 'rep-1', memberKey: 'hannes', member: 'hannes', ts: 2 },
      { eventId: 'rep-1', memberKey: 'hannes', member: 'hannes', type: 'rsvp', ts: 4 },
    ]);
  });

  it('toggles member responses without leaving conflicting RSVP and decline rows', () => {
    const switched = toggleCalendarEventResponse(entries, {
      eventId: 'rep-1',
      eventTitle: 'Rep 1',
      eventStart: '2026-04-10T18:00:00.000Z',
      memberKey: 'hannes',
      responseType: 'decline',
      ts: 10,
    });
    expect(getCalendarEventParticipationState(switched, 'rep-1', 'hannes')).toMatchObject({
      hasRsvp: false,
      hasDeclined: true,
    });

    const toggledOff = toggleCalendarEventResponse(switched, {
      eventId: 'rep-1',
      eventTitle: 'Rep 1',
      eventStart: '2026-04-10T18:00:00.000Z',
      memberKey: 'hannes',
      responseType: 'decline',
      ts: 11,
    });
    expect(getCalendarEventParticipationState(toggledOff, 'rep-1', 'hannes')).toMatchObject({
      hasRsvp: false,
      hasDeclined: false,
    });
  });

  it('adds presence check-ins idempotently and can derive own entries', () => {
    const next = addCalendarPresenceCheckIn(entries, {
      eventId: 'rep-2',
      eventTitle: 'Rep 2',
      memberKey: 'hannes',
      ts: 20,
    });
    const duplicate = addCalendarPresenceCheckIn(next, {
      eventId: 'rep-2',
      eventTitle: 'Rep 2',
      memberKey: 'hannes',
      ts: 21,
    });

    expect(getOwnCalendarCheckIns(duplicate, 'hannes')).toEqual([
      { eventId: 'rep-1', memberKey: 'hannes', member: 'hannes', type: 'rsvp' },
      { eventId: 'rep-2', memberKey: 'hannes', member: 'hannes', type: 'rsvp' },
      { eventId: 'rep-2', eventTitle: 'Rep 2', memberKey: 'hannes', member: 'hannes', ts: 20 },
    ]);
  });
});
