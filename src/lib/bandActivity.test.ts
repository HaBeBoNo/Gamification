import { describe, expect, it } from 'vitest';
import { summarizeBandActivitySnapshot } from './bandActivity';

describe('bandActivity snapshot summary', () => {
  it('counts active members across shared activity and presence without double-counting', () => {
    expect(summarizeBandActivitySnapshot({
      recentFeedRows: [
        { who: 'hannes', created_at: '2026-04-10T08:00:00.000Z', xp: 120 },
        { who: 'niklas', created_at: '2026-04-10T09:00:00.000Z', xp: 40 },
      ],
      todayFeedRows: [
        { who: 'hannes', created_at: '2026-04-10T08:00:00.000Z', xp: 120 },
      ],
      todayPresenceRows: [
        { member_key: 'hannes', last_seen_at: '2026-04-10T10:00:00.000Z' },
        { member_key: 'niklas', last_seen_at: '2026-04-10T10:05:00.000Z' },
      ],
      activeNow: 1,
      localMemberIsLive: true,
    })).toEqual({
      activeToday: 2,
      xp48h: 160,
      activeNow: 1,
    });
  });

  it('uses local liveness as a floor when realtime presence is missing', () => {
    expect(summarizeBandActivitySnapshot({
      recentFeedRows: [],
      todayFeedRows: [],
      todayPresenceRows: [],
      activeNow: null,
      localMemberIsLive: true,
    })).toEqual({
      activeToday: 1,
      xp48h: 0,
      activeNow: 1,
    });
  });
});
