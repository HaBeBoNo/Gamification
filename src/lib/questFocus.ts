import { isQuestDoneNow } from '@/lib/questUtils';

type QuestLike = Record<string, any>;

function getDeadlineUrgencyScore(quest: QuestLike): number {
  if (!quest.deadline) return 0;

  const deadlineMs = Number(quest.deadline);
  if (!Number.isFinite(deadlineMs)) return 0;

  const diffHours = (deadlineMs - Date.now()) / (1000 * 60 * 60);
  if (diffHours <= 0) return 16;
  if (diffHours <= 24) return 14;
  if (diffHours <= 72) return 10;
  if (diffHours <= 168) return 6;
  return 2;
}

function getCollaborativePressureScore(quest: QuestLike, memberKey?: string): number {
  if (!memberKey || !quest.collaborative || !(quest.participants || []).includes(memberKey)) return 0;

  const completedBy = quest.completedBy || quest.completed_by || [];
  if (completedBy.includes(memberKey)) return 0;
  if ((completedBy || []).length > 0) return 15;
  return 9;
}

function getOwnershipScore(quest: QuestLike, memberKey?: string): number {
  if (!memberKey) return 0;
  if (quest.delegatedTo === memberKey && !quest.delegationHandled) return 18;
  if (quest.owner === memberKey) return 16;
  if (quest.personal) return 14;
  return 0;
}

function getTypeScore(quest: QuestLike): number {
  if (quest.recur === 'daily') return 8;
  if (quest.type === 'strategic') return 7;
  if (quest.type === 'sidequest') return 3;
  if (quest.collaborative) return 6;
  return 4;
}

export function scoreQuestRelevance(quest: QuestLike, memberKey?: string): number {
  if (!quest || isQuestDoneNow(quest)) return Number.NEGATIVE_INFINITY;

  return (
    getOwnershipScore(quest, memberKey) +
    getCollaborativePressureScore(quest, memberKey) +
    getDeadlineUrgencyScore(quest) +
    getTypeScore(quest) +
    Math.min(Number(quest.xp || 0) / 40, 6)
  );
}

export function getRelevantActiveQuests(quests: QuestLike[], memberKey?: string, limit = 3): QuestLike[] {
  return [...(quests || [])]
    .filter((quest) => !isQuestDoneNow(quest))
    .sort((left, right) => {
      const scoreDiff = scoreQuestRelevance(right, memberKey) - scoreQuestRelevance(left, memberKey);
      if (scoreDiff !== 0) return scoreDiff;

      const deadlineDiff = Number(left.deadline || Infinity) - Number(right.deadline || Infinity);
      if (deadlineDiff !== 0 && Number.isFinite(deadlineDiff)) return deadlineDiff;

      return Number(right.createdAt || right.id || 0) - Number(left.createdAt || left.id || 0);
    })
    .slice(0, limit);
}

export function getQuestFocusReason(quest: QuestLike, memberKey?: string): string {
  if (!quest) return 'Nästa steg.';

  if (quest.delegatedTo === memberKey && !quest.delegationHandled) {
    return 'Väntar på ditt svar.';
  }

  const completedBy = quest.completedBy || quest.completed_by || [];
  if (quest.collaborative && (quest.participants || []).includes(memberKey) && !completedBy.includes(memberKey)) {
    if ((completedBy || []).length > 0) {
      return 'Bandet rör sig här.';
    }
    return 'Bra ihop med bandet.';
  }

  if (quest.deadline) {
    const diffHours = (Number(quest.deadline) - Date.now()) / (1000 * 60 * 60);
    if (diffHours <= 24) return 'Bra före deadline.';
    if (diffHours <= 72) return 'Bra läge nu.';
  }

  if (quest.recur === 'daily') {
    return 'Snabb vinst.';
  }

  if (quest.type === 'strategic') {
    return 'Bygger riktning.';
  }

  if (quest.personal || quest.owner === memberKey) {
    return 'Närmast din bana.';
  }

  return 'Bra nästa steg.';
}

export function buildCoachNextDirection(completedQuest: QuestLike, nextQuest?: QuestLike | null): string {
  if (nextQuest?.title) {
    return `Bra. Nästa: ${nextQuest.title}.`;
  }

  if (completedQuest?.recur === 'daily') {
    return 'Bra. Håll rytmen.';
  }

  return 'Bra. Välj nästa steg.';
}
