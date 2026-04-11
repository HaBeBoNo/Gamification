import { afterEach, describe, expect, it } from 'vitest';
import { S } from '@/state/store';
import { canInitiate, getReengagementMode, isInActiveFlow, markCoachInitiated } from './coachPolicy';

const originalQuests = [...S.quests];

afterEach(() => {
  S.quests = [...originalQuests];
});

describe('coachPolicy', () => {
  it('returns false when the coach already initiated within the last 24 hours', () => {
    const now = Date.now();
    markCoachInitiated('coach-policy-hannes', now - (2 * 60 * 60 * 1000));

    expect(canInitiate('coach-policy-hannes', now)).toBe(false);
  });

  it('treats an ongoing quest as an active flow', () => {
    S.quests = [{
      id: 991,
      owner: 'coach-policy-member',
      title: 'Pågående uppdrag',
      desc: 'Testar aktivt flöde',
      cat: 'wisdom',
      xp: 25,
      region: 'Personal',
      recur: 'none',
      type: 'standard',
      done: false,
    }];

    expect(isInActiveFlow('coach-policy-member')).toBe(true);
  });

  it('maps reengagement stages to the expected coach mode', () => {
    expect(getReengagementMode({ reengagementStage: 'active' })).toBe('silent');
    expect(getReengagementMode({ reengagementStage: 'quiet_3' })).toBe('proactive');
    expect(getReengagementMode({ reengagementStage: 'quiet_7' })).toBe('summary');
    expect(getReengagementMode({ reengagementStage: 'quiet_14' })).toBe('summary');
  });
});
