import { describe, expect, it } from 'vitest';
import { mergeMemberCheckIns, mergeReminders } from './memberData';

describe('memberData helpers', () => {
  it('merges reminders by member and event without duplicating the same reminder', () => {
    expect(mergeReminders(
      [{ eventId: 'rep-1', eventTitle: 'Rep', memberKey: 'hannes', eventStart: '2026-04-10T18:00:00.000Z', ts: 1 }],
      [{ eventId: 'rep-1', eventTitle: 'Rep', memberKey: 'hannes', eventStart: '2026-04-10T18:00:00.000Z', ts: 2 }]
    )).toEqual([
      { eventId: 'rep-1', eventTitle: 'Rep', memberKey: 'hannes', eventStart: '2026-04-10T18:00:00.000Z', ts: 1 },
    ]);
  });

  it('merges check-ins across members while keeping one canonical entry per member/event/type', () => {
    expect(mergeMemberCheckIns('hannes', [
      { eventId: 'rep-1', member: 'hannes', ts: 1 },
      { eventId: 'rep-1', memberKey: 'hannes', type: 'rsvp', ts: 2 },
    ], [
      { member_key: 'niklas', data: { checkIns: [{ eventId: 'rep-1', memberKey: 'niklas', type: 'decline', ts: 3 }] } },
      { member_key: 'ludvig', data: { checkIns: [{ eventId: 'rep-1', memberKey: 'ludvig', ts: 4 }] } },
    ])).toEqual([
      { eventId: 'rep-1', memberKey: 'hannes', member: 'hannes', ts: 1 },
      { eventId: 'rep-1', memberKey: 'hannes', member: 'hannes', type: 'rsvp', ts: 2 },
      { eventId: 'rep-1', memberKey: 'niklas', member: 'niklas', type: 'decline', ts: 3 },
      { eventId: 'rep-1', memberKey: 'ludvig', member: 'ludvig', ts: 4 },
    ]);
  });
});
