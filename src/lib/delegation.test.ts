import { describe, expect, it } from 'vitest';
import type { Quest } from '@/types/game';
import {
  acceptQuestDelegation,
  applyQuestDelegation,
  declineQuestDelegation,
} from './delegation';

function makeQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 101,
    owner: 'hannes',
    title: 'Testuppdrag',
    desc: 'Beskrivning',
    cat: 'social',
    xp: 40,
    region: 'Personal',
    recur: 'none',
    type: 'personal',
    done: false,
    ...overrides,
  };
}

describe('delegation helpers', () => {
  it('marks a quest as delegated with sender, receiver and note', () => {
    const quest = makeQuest();
    applyQuestDelegation(quest, {
      delegatedBy: 'hannes',
      delegatedTo: 'ludvig',
      note: 'Kan du ta denna?',
      ts: 12345,
    });

    expect(quest.delegatedBy).toBe('hannes');
    expect(quest.delegatedTo).toBe('ludvig');
    expect(quest.delegationNote).toBe('Kan du ta denna?');
    expect(quest.delegationHandled).toBe(false);
    expect(quest.delegationStatus).toBe('pending');
    expect(quest.delegatedAt).toBe(12345);
  });

  it('accepts a delegated quest and moves ownership to the receiver', () => {
    const quest = makeQuest({
      delegatedBy: 'hannes',
      delegatedTo: 'ludvig',
      delegationHandled: false,
    });

    acceptQuestDelegation(quest, 'ludvig', 67890);

    expect(quest.owner).toBe('ludvig');
    expect(quest.personal).toBe(true);
    expect(quest.delegatedTo).toBe('ludvig');
    expect(quest.delegationHandled).toBe(true);
    expect(quest.delegationStatus).toBe('accepted');
    expect(quest.delegationAcceptedAt).toBe(67890);
  });

  it('declines a delegated quest without counting it as accepted work', () => {
    const quest = makeQuest({
      delegatedBy: 'hannes',
      delegatedTo: 'ludvig',
      delegationHandled: false,
    });

    declineQuestDelegation(quest, 'ludvig', 77777);

    expect(quest.owner).toBe('hannes');
    expect(quest.delegatedTo).toBeNull();
    expect(quest.delegationHandled).toBe(true);
    expect(quest.delegationStatus).toBe('declined');
    expect(quest.declinedBy).toBe('ludvig');
    expect(quest.delegationDeclinedAt).toBe(77777);
  });
});
