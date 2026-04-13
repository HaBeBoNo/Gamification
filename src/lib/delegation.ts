import type { Quest } from '@/types/game';

export type DelegationStatus = 'pending' | 'accepted' | 'declined';

export function applyQuestDelegation(
  quest: Quest,
  params: {
    delegatedBy: string;
    delegatedTo: string;
    note?: string | null;
    ts?: number;
  }
): Quest {
  const ts = params.ts ?? Date.now();

  quest.delegatedBy = params.delegatedBy;
  quest.delegatedTo = params.delegatedTo;
  quest.delegationNote = params.note?.trim() || null;
  quest.delegationHandled = false;
  quest.delegationStatus = 'pending' satisfies DelegationStatus;
  quest.delegatedAt = ts;
  quest.delegationHandledAt = null;
  quest.delegationAcceptedAt = null;
  quest.delegationDeclinedAt = null;
  quest.declinedBy = null;

  return quest;
}

export function acceptQuestDelegation(
  quest: Quest,
  memberKey: string,
  ts = Date.now()
): Quest {
  quest.owner = memberKey;
  quest.personal = true;
  quest.delegatedTo = memberKey;
  quest.delegationHandled = true;
  quest.delegationStatus = 'accepted' satisfies DelegationStatus;
  quest.delegationHandledAt = ts;
  quest.delegationAcceptedAt = ts;
  quest.declinedBy = null;

  return quest;
}

export function declineQuestDelegation(
  quest: Quest,
  memberKey: string,
  ts = Date.now()
): Quest {
  quest.delegationHandled = true;
  quest.delegationStatus = 'declined' satisfies DelegationStatus;
  quest.delegationHandledAt = ts;
  quest.delegationDeclinedAt = ts;
  quest.declinedBy = memberKey;
  quest.delegatedTo = null;

  return quest;
}
