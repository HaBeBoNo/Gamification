// ═══════════════════════════════════════════════════════════════
// useXP.js — XP-logik för Sektionen Gamification
// Mönster: direkt mutation av S + save() → notify() via Zustand
// Exporterar: calcQuestXP, awardXP, awardMetricPts
// ═══════════════════════════════════════════════════════════════

import { S, save, notify } from '../state/store';
import { MEMBERS, ROLE_TYPES } from '../data/members';

// ── Interna hjälpfunktioner ──────────────────────────────────────

function xpForLevel(lv) {
  return Math.floor(100 * Math.pow(1.18, lv - 1));
}

function catToStat(cat) {
  switch (cat) {
    case 'health': return 'vit';
    case 'wisdom': return 'wis';
    case 'money':  return 'for';
    case 'social': return 'cha';
    case 'tech':   return 'wis';  // tech = +2, hanteras nedan
    case 'global': return null;   // global = cha + for, hanteras separat
    default:       return null;
  }
}

function calcMilestoneBonus(memberId, baseXp) {
  if (baseXp < 150) return 0;
  const rt = MEMBERS[memberId]?.roleType || 'amplifier';
  return { enabler: 25, builder: 20, amplifier: 10 }[rt] ?? 0;
}

function calcWorkPts(memberId, baseXp, region) {
  const rt       = MEMBERS[memberId]?.roleType || 'amplifier';
  const rtDef    = ROLE_TYPES[rt] || {};
  const workMult = rtDef.workMult ?? 1.0;
  let base = Math.round(baseXp * 0.5 * workMult);
  if (region?.includes('Japan'))  base = Math.round(base * 1.5);
  if (region?.includes('Global')) base = Math.round(base * 1.2);
  return base;
}

// ── Exporterade funktioner ────────────────────────────────────────

/**
 * calcQuestXP(memberId, baseXp)
 * Skalerar baseXp med rolltyp-multiplikator.
 * Ren funktion — behöver inget state.
 */
export function calcQuestXP(memberId, baseXp) {
  const rt   = MEMBERS[memberId]?.roleType || 'amplifier';
  const mult = ROLE_TYPES[rt]?.xpScaling  ?? 1.0;
  return Math.round(baseXp * mult);
}

/**
 * awardXP(q, xpEarned, event, showLU, showRW, showXPPop, rollReward)
 *
 * q           Quest-objekt (id, xp, cat, recur, region, title)
 * xpEarned    Basalt XP — kan vara reducerat av AI-validering
 * event       MouseEvent för XP-pop-position (kan vara null)
 * showLU      (level) => void  — level-up overlay (valfri)
 * showRW      (reward) => void — reward overlay (valfri)
 * showXPPop   (xp, event) => void — floating XP-text (valfri)
 * rollReward  (xp) => reward | null — slumpar belöning (valfri)
 */
export function awardXP(q, xpEarned, event, showLU, showRW, showXPPop, rollReward) {
  const c = S.chars[S.me];
  const m = MEMBERS[S.me];
  if (!c || !m) return;

  // 1. Roll-skalat XP
  const roleScaledXP = calcQuestXP(S.me, xpEarned);

  // 2. Eskalerande streak-bonus — implicit 10× system
  //    0–7 d: 1%/dag · 8–14: accelererar · 15–30: fortsätter · 30+: max 80%
  const st = c.streak || 0;
  let streakBonus;
  if      (st <= 7)  streakBonus = st * 0.01;
  else if (st <= 14) streakBonus = 0.07  + (st - 7)  * 0.015;
  else if (st <= 30) streakBonus = 0.175 + (st - 14) * 0.017;
  else               streakBonus = Math.min(0.80, 0.45 + (st - 30) * 0.012);

  const boosted   = Math.round(roleScaledXP * (1 + streakBonus));
  const milestone = calcMilestoneBonus(S.me, q.xp);
  const totalXP   = boosted + milestone;

  // 3. Streak-logik: konsekutiva dagar med minst en quest-completion
  const prevQuestDate = c.lastQuestDate || 0;
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const prevDay = new Date(prevQuestDate); prevDay.setHours(0, 0, 0, 0);
  const dayGap  = prevQuestDate ? Math.round((today - prevDay) / 86400000) : 0;

  if      (dayGap === 1) c.streak = (c.streak || 0) + 1;
  else if (dayGap === 0) c.streak = c.streak || 1;
  else                   c.streak = 1;

  c.lastQuestDate = Date.now();
  c.lastSeen      = Date.now();

  // 4. XP och level-progression
  c.xp         = (c.xp      || 0) + totalXP;
  c.totalXp    = (c.totalXp || 0) + totalXP;
  c.questsDone = (c.questsDone || 0) + 1;
  c.xpToNext   = c.xpToNext || xpForLevel(c.level || 1);

  let leveled = false;
  while (c.xp >= c.xpToNext) {
    c.xp      -= c.xpToNext;
    c.level    = (c.level || 1) + 1;
    c.xpToNext = xpForLevel(c.level);
    Object.keys(c.stats || {}).forEach(k => {
      c.stats[k] = Math.min(100, (c.stats[k] || 0) + 1);
    });
    leveled = true;
  }

  // 5. Karaktärs-stats utifrån quest-kategori
  c.stats         = c.stats         || { vit: 10, wis: 10, for: 10, cha: 10 };
  c.categoryCount = c.categoryCount || {};
  c.categoryCount[q.cat] = (c.categoryCount[q.cat] || 0) + 1;

  const stat = catToStat(q.cat);
  if (stat) {
    const inc     = q.cat === 'tech' ? 2 : 1;
    c.stats[stat] = Math.min(100, (c.stats[stat] || 10) + inc);
  }
  if (q.cat === 'global') {
    c.stats.cha = Math.min(100, (c.stats.cha || 10) + 1);
    c.stats.for = Math.min(100, (c.stats.for || 10) + 1);
  }

  // 6. Arbetspoäng för scoreboard
  c.pts = c.pts || { work: 0, spotify: 0, social: 0, bonus: 0 };
  c.pts.work += calcWorkPts(S.me, q.xp, q.region);
  if (milestone > 0) c.pts.bonus += Math.round(milestone * 0.5);

  // 7. Form-tracker (senaste 5 completions)
  c.form = c.form || [];
  c.form.push('W');
  if (c.form.length > 5) c.form.shift();

  // 8. Quest-status — markera done om recur:'none'
  const questIdx = S.quests.findIndex(sq => sq.id === q.id);
  if (questIdx !== -1 && S.quests[questIdx].recur === 'none') {
    S.quests[questIdx].done = true;
    /* ── temporalBehavior tracking ── */
    const _tq = S.quests.find(sq => sq.id === q.id);
    if (_tq?.deadline) {
    const totalWindow = _tq.deadline - (_tq.createdAt || (_tq.deadline - 7 * 86400000));
    const remaining   = _tq.deadline - Date.now();
    const urgency     = Math.max(0, Math.min(1, 1 - remaining / totalWindow));

    if (!S.chars[S.me].temporalBehavior) {
      S.chars[S.me].temporalBehavior = { history: [], pattern: 'unknown', avgUrgency: 0.5, anomaly: false };
    }
    const tb = S.chars[S.me].temporalBehavior;
    tb.history = [...(tb.history || []), urgency].slice(-20);

    const avg = tb.history.reduce((a, b) => a + b, 0) / tb.history.length;
    tb.avgUrgency = avg;
    tb.pattern    = avg < 0.35 ? 'early' : avg > 0.7 ? 'deadline-driven' : 'steady';
    tb.anomaly    = Math.abs(urgency - avg) > 0.4;
    tb.lastUpdated = Date.now();
    }
    }
  // Recurring quests: QuestCard ansvarar för att återaktivera kortet via setTimeout

  // 9. Activity feed
  const ts = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const feedAction = milestone > 0
    ? `completed "${q.title}" — milestone bonus +${milestone} XP`
    : `completed "${q.title}"`;

  S.feed.push({ who: S.me, action: feedAction, xp: totalXP, time: ts });
  if (leveled) S.feed.push({ who: S.me, action: `leveled up to Level ${c.level}!`, xp: 0, time: ts });
  if (S.feed.length > 50) S.feed.splice(0, S.feed.length - 50);

  // 10. Commit — skriv tillbaka och spara (save() triggar notify() → Zustand re-render)
  S.chars[S.me] = c;
  save();

  // 11. UI-effekter (efter render)
  showXPPop?.(totalXP, event);

  if (leveled) {
    setTimeout(() => showLU?.(c.level), 700);
  } else {
    setTimeout(() => showRW?.(rollReward?.(q.xp) ?? null), 550);
  }

  // 12. Recurring quest: re-render efter animation
  if (q.recur !== 'none') {
    setTimeout(() => notify(), 2200);
  }

  return { totalXP, leveled, level: c.level };
}

/**
 * awardMetricPts(memberId, deltas)
 * Awards scoreboard pts based on metric changes (called from MetricsModal).
 * deltas: { spf, str, ig, x, tix } — positive = increase
 */
export function awardMetricPts(memberId, deltas) {
  const c = S.chars[memberId];
  if (!c) return;
  c.pts = c.pts || { work: 0, spotify: 0, social: 0, bonus: 0 };
  if (deltas.spf > 0) c.pts.spotify += Math.round(deltas.spf * 0.1);
  if (deltas.str > 0) c.pts.spotify += Math.round(deltas.str * 0.001);
  if (deltas.ig  > 0) c.pts.social  += Math.round(deltas.ig  * 0.1);
  if (deltas.x   > 0) c.pts.social  += Math.round(deltas.x   * 0.2);
  if (deltas.tix > 0) c.pts.bonus   += Math.round(deltas.tix * 1.0);
  S.chars[memberId] = c;
  save();
}
