// ═══════════════════════════════════════════════════════════════
// useXP.js — XP-logik för Sektionen Gamification
// Exporterar: calcQuestXP, awardXP
// Konsumeras av: QuestCard.jsx, QuestGrid.jsx
// ═══════════════════════════════════════════════════════════════

import { MEMBERS, ROLE_TYPES } from '../data/members';
import { useStore } from '../state/store';

// ── Hjälpfunktioner ──────────────────────────────────────────────

function xpForLevel(lv) {
  return Math.floor(100 * Math.pow(1.18, lv - 1));
}

// Stat-kategori → karaktärsattribut
function catToStat(cat) {
  switch (cat) {
    case 'health': return 'vit';
    case 'wisdom': return 'wis';
    case 'money':  return 'for';
    case 'social': return 'cha';
    case 'tech':   return 'wis'; // tech mastery räknas som wisdom +2
    case 'global': return null;  // global påverkar cha + for
    default:       return null;
  }
}

// Milestone-bonus för stora strukturella quests
// Enablers och Builders får mer för högt-XP quests
function calcMilestoneBonus(memberId, baseXp) {
  const rt = MEMBERS[memberId]?.roleType || 'amplifier';
  if (baseXp < 150) return 0;
  const bonusMap = { enabler: 25, builder: 20, amplifier: 10 };
  return bonusMap[rt] || 0;
}

// Arbetspoäng — roll-viktade, regions-bonifierade
function calcWorkPts(memberId, baseXp, region) {
  const rt    = MEMBERS[memberId]?.roleType || 'amplifier';
  const rtDef = ROLE_TYPES[rt] || {};
  const workMult   = rtDef.workMult   ?? 1.0;
  const workPerXP  = 0.5;
  let base = Math.round(baseXp * workPerXP * workMult);
  if (region?.includes('Japan'))  base = Math.round(base * 1.5);
  if (region?.includes('Global')) base = Math.round(base * 1.2);
  return base;
}

// ── Exporterade hooks ─────────────────────────────────────────────

/**
 * calcQuestXP(memberId, baseXp)
 * Skalerar basexP med rolltyp-multiplikator.
 * Returnerar avrundat heltal.
 */
export function calcQuestXP(memberId, baseXp) {
  const rt   = MEMBERS[memberId]?.roleType || 'amplifier';
  const mult = ROLE_TYPES[rt]?.xpScaling  ?? 1.0;
  return Math.round(baseXp * mult);
}

/**
 * useXP()
 * Hook som returnerar awardXP — bunden till store-state.
 *
 * awardXP(q, xpEarned, event?)
 *   q         Quest-objekt (behöver id, xp, cat, recur, region, title)
 *   xpEarned  Basalt XP att tilldela (kan vara reducerat av AI-validering)
 *   event     MouseEvent för XP-pop-position (valfri)
 */
export function useXP() {
  const { state: S, setState } = useStore();

  function awardXP(q, xpEarned, event) {
    const c = { ...S.chars[S.me] };
    const m = MEMBERS[S.me];
    if (!c || !m) return;

    // 1. Roll-skalat XP
    const roleScaledXP = calcQuestXP(S.me, xpEarned);

    // 2. Eskalerande streak-bonus — implicit 10× system
    //    0–7 dagar: 1%/dag
    //    8–14: accelererar till ~21%
    //    15–30: fortsätter till ~45%
    //    30+: max 80%
    const st = c.streak || 0;
    let streakBonus;
    if      (st <= 7)  streakBonus = st * 0.01;
    else if (st <= 14) streakBonus = 0.07  + (st - 7)  * 0.015;
    else if (st <= 30) streakBonus = 0.175 + (st - 14) * 0.017;
    else               streakBonus = Math.min(0.80, 0.45 + (st - 30) * 0.012);

    const boosted = Math.round(roleScaledXP * (1 + streakBonus));

    // 3. Milestone-bonus för stora quests
    const milestone = calcMilestoneBonus(S.me, q.xp);
    const totalXP   = boosted + milestone;

    // 4. Streak-logik: konsekutiva dagar med minst en quest-completion
    const prevQuestDate = c.lastQuestDate || 0;
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const prevDay  = new Date(prevQuestDate); prevDay.setHours(0, 0, 0, 0);
    const dayGap   = prevQuestDate ? Math.round((today - prevDay) / 86400000) : 0;

    if      (dayGap === 1) c.streak = (c.streak || 0) + 1; // fortsatt streak
    else if (dayGap === 0) c.streak = c.streak || 1;        // samma dag
    else                   c.streak = 1;                    // reset

    c.lastQuestDate = Date.now();
    c.lastSeen      = Date.now();

    // 5. XP och level-progression
    c.xp       = (c.xp || 0) + totalXP;
    c.totalXp  = (c.totalXp || 0) + totalXP;
    c.questsDone = (c.questsDone || 0) + 1;

    c.xpToNext = c.xpToNext || xpForLevel(c.level || 1);
    let leveled = false;
    while (c.xp >= c.xpToNext) {
      c.xp     -= c.xpToNext;
      c.level   = (c.level || 1) + 1;
      c.xpToNext = xpForLevel(c.level);
      Object.keys(c.stats || {}).forEach(k => {
        c.stats[k] = Math.min(100, (c.stats[k] || 0) + 1);
      });
      leveled = true;
    }

    // 6. Karaktärs-stats utifrån quest-kategori
    c.stats = c.stats || { vit: 10, wis: 10, for: 10, cha: 10 };
    c.categoryCount = c.categoryCount || {};
    c.categoryCount[q.cat] = (c.categoryCount[q.cat] || 0) + 1;

    const stat = catToStat(q.cat);
    if (stat) {
      const inc = q.cat === 'tech' ? 2 : 1;
      c.stats[stat] = Math.min(100, (c.stats[stat] || 10) + inc);
    }
    if (q.cat === 'global') {
      c.stats.cha = Math.min(100, (c.stats.cha || 10) + 1);
      c.stats.for = Math.min(100, (c.stats.for || 10) + 1);
    }

    // 7. Arbetspoäng för scoreboard
    c.pts = c.pts || { work: 0, spotify: 0, social: 0, bonus: 0 };
    c.pts.work  += calcWorkPts(S.me, q.xp, q.region);
    if (milestone > 0) c.pts.bonus += Math.round(milestone * 0.5);

    // 8. Form-tracker (senaste 5 quests)
    c.form = c.form || [];
    c.form.push('W');
    if (c.form.length > 5) c.form.shift();

    // 9. Quest-status
    const updatedQuests = S.quests.map(sq => {
      if (sq.id !== q.id) return sq;
      if (sq.recur === 'none') return { ...sq, done: true };
      return sq; // recurring quests återställs via timer i UI
    });

    // 10. Activity feed
    const feedAction = milestone > 0
      ? `completed "${q.title}" — milestone bonus +${milestone} XP`
      : `completed "${q.title}"`;

    const newFeed = [
      ...S.feed,
      { who: S.me, action: feedAction, xp: totalXP, time: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) },
      ...(leveled ? [{ who: S.me, action: `leveled up to Level ${c.level}!`, xp: 0, time: new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) }] : []),
    ].slice(-50); // håll feed rimlig i storlek

    setState(prev => ({
      ...prev,
      chars:  { ...prev.chars,  [S.me]: c },
      quests: updatedQuests,
      feed:   newFeed,
    }));

    return { totalXP, leveled, level: c.level };
  }

  return { awardXP, calcQuestXP };
}
