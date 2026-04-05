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
 *   'personal'      — bas-quests från quests.js ELLER
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

  // Allt annat: bas-quests från quests.js + AI-genererade quests → 'generated'
  return 'generated';
}

export const ORIGIN_LABELS: Record<string, string> = {
  generated: '🤖',
  collaborative: '🤝',
  personal: '⭐',
};
