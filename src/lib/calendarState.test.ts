import { describe, expect, it } from 'vitest';
import {
  getCalendarEventParticipationState,
  getEventCheckInCount,
  getEventDeclineCount,
  getEventRSVPCount,
  hasEventDecline,
  hasEventRSVP,
  isCheckedInByMember,
  isPresenceCheckIn,
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
});
