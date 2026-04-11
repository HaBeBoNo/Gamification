import { beforeEach, describe, expect, it } from 'vitest';
import { S, useGameStore } from '@/state/store';
import { getCoachContext } from './coachContext';

describe('coachContext presence precision', () => {
  beforeEach(() => {
    S.me = 'hannes';
    useGameStore.setState({
      feed: [],
      feedHydrated: true,
      notifications: [],
      presenceMembers: [],
      presenceHydrated: true,
    });
  });

  it('derives active members now from presence rows instead of feed and notification heuristics', () => {
    const now = Date.parse('2026-04-11T10:00:00.000Z');

    useGameStore.setState({
      feed: [
        {
          who: 'simon',
          action: 'gav en signal',
          created_at: '2026-04-11T09:58:00.000Z',
        },
      ],
      notifications: [
        {
          id: 'notif-1',
          type: 'feed_comment',
          ts: now - 60_000,
          read: false,
          payload: { memberId: 'ludvig' },
        },
      ],
      presenceMembers: [
        {
          member_key: 'niklas',
          current_surface: 'quests',
          is_online: true,
          last_seen_at: '2026-04-11T09:59:30.000Z',
        },
      ],
      presenceHydrated: true,
    });

    const context = getCoachContext('hannes', now);

    expect(context.otherActiveMemberKeys).toEqual(['niklas']);
  });
});
