// ── questUtils.ts ─────────────────────────────────────────────────
// Delad util för quest-ursprung.
// Importeras av QuestGrid.tsx och QuestCard.tsx.
// ─────────────────────────────────────────────────────────────────

/**
 * getQuestOrigin
 *
 * Bestämmer varifrån ett quest kommer:
 *   'collaborative' — har collaborative-flagga eller participants-fält
 *   'generated'     — AI-coach-genererat: personal === true och type !== 'personal'
 *                     (AI-genererade quests sätts med personal: true men typ
 *                      'standard'/'strategic'/etc. — aldrig 'personal')
 *   'personal'      — bas-quests från quests.ts ELLER
 *                     användarskapade via CreateQuestModal (type: 'personal')
 *
 * Notera: `id >= 900` används INTE — AI-genererade quests får dynamiska ID:n
 * via Math.max(400, ...S.quests) + 1 och identifieras bättre via personal-flaggan.
 */
export function getQuestOrigin(quest: any): 'generated' | 'collaborative' | 'personal' {
  // Kollaborativa checkas först — collaborative-flagga eller icke-tom participants-array
  if (quest.collaborative === true || (quest.participants && quest.participants.length > 0)) return 'collaborative';

  // Egenskapade — användarskapade soloquest via CreateQuestModal (type: 'personal', ej collaborative)
  if (quest.type === 'personal' && !quest.collaborative) return 'personal';

  // Allt annat: bas-quests från quests.ts + AI-genererade quests → 'generated'
  return 'generated';
}

export function getCompletedByMembers(quest: any): string[] {
  const completedBy = quest?.completedBy ?? quest?.completed_by;
  if (!completedBy) return [];
  if (Array.isArray(completedBy)) return completedBy.filter(Boolean);
  return typeof completedBy === 'string' ? [completedBy] : [];
}

export function isQuestRelevantToMember(quest: any, memberId: string): boolean {
  if (!quest || !memberId) return false;
  if (quest.owner === memberId) return true;
  return getCompletedByMembers(quest).includes(memberId);
}

export function wasQuestCompletedByMember(quest: any, memberId: string): boolean {
  if (!quest || !memberId) return false;
  if (quest.owner === memberId) return Boolean(quest.completedAt || quest.completionCount || quest.done);
  return getCompletedByMembers(quest).includes(memberId);
}

export const ORIGIN_LABELS: Record<string, string> = {
  generated: 'AI',
  collaborative: 'TEAM',
  personal: 'EGEN',
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function getLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getIsoWeekKey(timestamp: number): string {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);

  const day = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - day);

  const yearStart = new Date(date.getFullYear(), 0, 1);
  yearStart.setHours(0, 0, 0, 0);

  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${pad(week)}`;
}

export function getQuestCycleKey(quest: { recur?: string }, timestamp = Date.now()): string | null {
  if (quest.recur === 'daily') return getLocalDateKey(timestamp);
  if (quest.recur === 'weekly') return getIsoWeekKey(timestamp);
  return null;
}

export function isQuestDoneNow(quest: any, timestamp = Date.now()): boolean {
  if (!quest) return false;
  if (quest.recur === 'none' || !quest.recur) return Boolean(quest.done);

  const currentCycle = getQuestCycleKey(quest, timestamp);
  return Boolean(quest.done && currentCycle && quest.lastCompletedCycle === currentCycle);
}

export function refreshRecurringQuestState(quest: any, timestamp = Date.now()): boolean {
  if (!quest || quest.recur === 'none' || !quest.recur) return false;

  const currentCycle = getQuestCycleKey(quest, timestamp);
  if (!currentCycle) return false;

  if (!quest.lastCompletedCycle) {
    if (quest.done) {
      quest.done = false;
      return true;
    }
    return false;
  }

  if (quest.done && quest.lastCompletedCycle !== currentCycle) {
    quest.done = false;
    return true;
  }

  return false;
}

export function refreshRecurringQuestStates(quests: any[], timestamp = Date.now()): boolean {
  let changed = false;

  quests.forEach(quest => {
    if (refreshRecurringQuestState(quest, timestamp)) changed = true;
  });

  return changed;
}
