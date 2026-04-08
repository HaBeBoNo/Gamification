import { describe, expect, it } from 'vitest';
import {
  getActivityAnchorTs,
  getDaysSinceActivity,
  getReengagementStage,
  isCalendarResponseNeeded,
} from './reengagement';

describe('reengagement', () => {
  it('uses the most recent personal activity anchor', () => {
    expect(getActivityAnchorTs(1_000, 5_000)).toBe(5_000);
    expect(getActivityAnchorTs(8_000, 2_000)).toBe(8_000);
  });

  it('maps inactivity windows to stable stages', () => {
    expect(getReengagementStage(0)).toBe('active');
    expect(getReengagementStage(3)).toBe('quiet_3');
    expect(getReengagementStage(7)).toBe('quiet_7');
    expect(getReengagementStage(14)).toBe('quiet_14');
  });

  it('calculates full days since activity', () => {
    const now = new Date('2026-04-08T12:00:00.000Z').getTime();
    const threeDaysAgo = new Date('2026-04-05T11:00:00.000Z').getTime();
    const yesterday = new Date('2026-04-07T20:00:00.000Z').getTime();

    expect(getDaysSinceActivity(threeDaysAgo, yesterday, now)).toBe(0);
    expect(getDaysSinceActivity(threeDaysAgo, undefined, now)).toBe(3);
  });

  it('only asks for calendar response when the event is close enough and unanswered', () => {
    const now = new Date('2026-04-08T12:00:00.000Z').getTime();

    expect(isCalendarResponseNeeded('2026-04-10T12:00:00.000Z', false, now)).toBe(true);
    expect(isCalendarResponseNeeded('2026-04-18T12:00:00.000Z', false, now)).toBe(false);
    expect(isCalendarResponseNeeded('2026-04-10T12:00:00.000Z', true, now)).toBe(false);
    expect(isCalendarResponseNeeded('2026-04-07T12:00:00.000Z', false, now)).toBe(false);
  });
});
