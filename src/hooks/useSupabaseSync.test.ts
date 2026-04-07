import { describe, it, expect, beforeEach } from 'vitest';
import { S, useGameStore } from '@/state/store';
import { buildMemberDataPayload, MEMBER_DATA_PAYLOAD_KEYS } from '@/hooks/useSupabaseSync';

describe('useSupabaseSync payload guardrails', () => {
  beforeEach(() => {
    S.me = 'hannes';
    S.chars.hannes = {
      ...S.chars.hannes,
      totalXp: 123,
      level: 2,
    };
    S.quests = [{
      id: 1,
      owner: 'hannes',
      title: 'Test',
      desc: 'Test quest',
      cat: 'wisdom',
      xp: 25,
      region: '🌐 Personal',
      recur: 'none',
      type: 'standard',
      done: false,
      personal: true,
    }];
    S.checkIns = [{ id: 'check-1' }];
    S.reminders = [{
      eventId: 'event-1',
      eventTitle: 'Rep',
      memberKey: 'hannes',
      eventStart: '2026-04-08T18:00:00.000Z',
      ts: 123,
    }];
    S.operationName = 'Operation Test';
    S.weeklyCheckouts = { hannes: { week: 14 } };
    S.seasonStart = '2026-01-01';
    S.seasonEnd = '2026-12-31';
    S.feed = [{ who: 'hannes', action: 'should not sync', xp: 0 }];

    useGameStore.setState({
      notifications: [
        {
          id: 'local-1',
          type: 'quest_complete',
          ts: Date.now(),
          read: false,
          source: 'local',
        },
        {
          id: 'remote-1',
          remoteId: 'remote-1',
          type: 'feed_comment',
          ts: Date.now(),
          read: false,
          source: 'supabase',
        },
      ],
    });
  });

  it('builds a payload with only the allowed member_data keys', () => {
    const payload = buildMemberDataPayload('hannes', useGameStore.getState().notifications);

    expect(Object.keys(payload).sort()).toEqual([...MEMBER_DATA_PAYLOAD_KEYS].sort());
  });

  it('stores only the active member char slice and excludes feed state', () => {
    const payload = buildMemberDataPayload('hannes', useGameStore.getState().notifications);

    expect(payload.chars).toEqual({ hannes: S.chars.hannes });
    expect('feed' in payload).toBe(false);
  });

  it('filters out remote notifications before writing member_data', () => {
    const payload = buildMemberDataPayload('hannes', useGameStore.getState().notifications);

    expect(payload.notifications).toHaveLength(1);
    expect(payload.notifications[0].source).toBe('local');
  });
});
