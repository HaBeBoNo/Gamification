// ═══════════════════════════════════════════════════════════════
// useXP.js — XP-logik för Sektionen Gamification
//
// Arkitektur (T3-C refactor):
//   calcAwardXP(c, m, q, xpEarned)  — Ren funktion. Beräknar allt.
//                                     Muterar ingenting. Enkel att testa.
//   awardXP(q, xpEarned, …)         — Orchestrator. Anropar calcAwardXP,
//                                     applicerar resultat på S, kallar save()
//                                     och notify(), triggar UI-callbacks.
//
// Exporterar:
//   calcQuestXP, calcCollaborativeBonus       — rena hjälpfunktioner
//   calcAwardXP                               — ren beräkning (ny, testbar)
//   awardXP                                   — side-effect orchestrator
//   awardMetricPts, awardInsightBonus
//   completeCollaborativeQuest
// ═══════════════════════════════════════════════════════════════

import { S, save, notify } from '../state/store';
import { MEMBERS, ROLE_TYPES } from '../data/members';
import { createLevelUpNotif, addNotifToAll } from '../state/notifications';
import { sendPush } from '../lib/sendPush';

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
    case 'tech':   return 'wis';  // tech = +2, hanteras i calcAwardXP
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

// ── Exporterade rena beräkningsfunktioner ────────────────────────

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
 * calcCollaborativeBonus(participantCount)
 * Returnerar XP-multiplikator baserat på antal deltagare (inkl. ägaren).
 */
export function calcCollaborativeBonus(participantCount) {
  if (participantCount >= 8) return 2.0;   // Hela bandet — dubbelt XP
  if (participantCount >= 3) return 1.5;   // 3+ members — +50%
  if (participantCount >= 2) return 1.25;  // 2 members — +25%
  return 1.0;
}

/**
 * calcAwardXP(c, m, q, xpEarned) — REN FUNKTION
 *
 * Beräknar alla XP-derivat utan att mutera state eller trigga side-effects.
 * Returnerar ett resultatobjekt som awardXP() sedan applicerar.
 *
 * @param {object} c         chars[memberId] snapshot
 * @param {object} m         MEMBERS[memberId]
 * @param {object} q         Quest-objekt (id, xp, cat, recur, region)
 * @param {number} xpEarned  Basalt XP (kan vara reducerat av AI-validering)
 * @param {string} memberId  Används för roll-lookup
 * @returns {{
 *   totalXP: number,
 *   milestone: number,
 *   workPts: number,
 *   milestoneWorkBonus: number,
 *   newStreak: number,
 *   newLevel: number,
 *   newXp: number,
 *   newXpToNext: number,
 *   leveled: boolean,
 *   statInc: { vit?: number, wis?: number, for?: number, cha?: number },
 *   feedAction: string,
 * }}
 */
export function calcAwardXP(c, m, q, xpEarned, memberId) {
  // 1. Roll-skalat XP
  const roleScaledXP = calcQuestXP(memberId, xpEarned);

  // 2. Eskalerande streak-bonus
  const st = c.streak || 0;
  let streakBonus;
  if      (st <= 7)  streakBonus = st * 0.01;
  else if (st <= 14) streakBonus = 0.07  + (st - 7)  * 0.015;
  else if (st <= 30) streakBonus = 0.175 + (st - 14) * 0.017;
  else               streakBonus = Math.min(0.80, 0.45 + (st - 30) * 0.012);

  const boosted   = Math.round(roleScaledXP * (1 + streakBonus));
  const milestone = calcMilestoneBonus(memberId, q.xp);

  const collaborativeMultiplier = q.collaborative
    ? calcCollaborativeBonus((q.participants?.length || 0) + 1)
    : 1.0;

  const totalXP = Math.round((boosted + milestone) * collaborativeMultiplier);

  // 3. Streak-logik
  const prevQuestDate = c.lastQuestDate || 0;
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const prevDay = new Date(prevQuestDate); prevDay.setHours(0, 0, 0, 0);
  const dayGap  = prevQuestDate ? Math.round((today.getTime() - prevDay.getTime()) / 86400000) : 0;

  let newStreak;
  if      (dayGap === 1) newStreak = (c.streak || 0) + 1;
  else if (dayGap === 0) newStreak = c.streak || 1;
  else                   newStreak = 1;

  // 4. Level-progression (ren simulering)
  let xp      = (c.xp || 0) + totalXP;
  let level   = c.level || 1;
  let xpToNext = c.xpToNext || xpForLevel(level);
  let leveled = false;

  while (xp >= xpToNext) {
    xp      -= xpToNext;
    level   += 1;
    xpToNext = xpForLevel(level);
    leveled  = true;
  }

  // 5. Stat-inkrementationer
  const statInc: Record<string, number> = {};
  const stat = catToStat(q.cat);
  if (stat) {
    statInc[stat] = (statInc[stat] || 0) + (q.cat === 'tech' ? 2 : 1);
  }
  if (q.cat === 'global') {
    statInc['cha'] = (statInc['cha'] || 0) + 1;
    statInc['for'] = (statInc['for'] || 0) + 1;
  }

  // 6. Arbetspoäng
  const workPts = calcWorkPts(memberId, q.xp, q.region);
  const milestoneWorkBonus = milestone > 0 ? Math.round(milestone * 0.5) : 0;

  // 7. Feed-text
  const feedAction = milestone > 0
    ? `completed "${q.title}" (+${totalXP} XP, +${milestone} milestone bonus)`
    : `completed "${q.title}" (+${totalXP} XP)`;

  return {
    totalXP,
    milestone,
    workPts,
    milestoneWorkBonus,
    newStreak,
    newLevel: level,
    newXp: xp,
    newXpToNext: xpToNext,
    leveled,
    statInc,
    feedAction,
  };
}

// ── Side-effect orchestrator ─────────────────────────────────────

/**
 * awardXP(q, xpEarned, event, showLU, showRW, showXPPop, rollReward)
 *
 * Orchestrator: anropar calcAwardXP för ren beräkning, applicerar sedan
 * resultatet på S, triggar notifikationer, sparar och notifierar.
 *
 * q           Quest-objekt (id, xp, cat, recur, region, title)
 * xpEarned    Basalt XP — kan vara reducerat av AI-validering
 * event       MouseEvent för XP-pop-position (kan vara null)
 * showLU      (level) => void  — level-up overlay (valfri)
 * showRW      (reward) => void — reward overlay (valfri)
 * showXPPop   (xp, event) => void — floating XP-text (valfri)
 * rollReward  (xp) => reward | null — slumpar belöning (valfri)
 */
export async function awardXP(
  q: any,
  xpEarned: number,
  event: MouseEvent | null,
  showLU?: (level: number) => void,
  showRW?: (reward: any, tier?: string) => void,
  showXPPop?: (xp: number, event: MouseEvent | null) => void,
  rollReward?: (xp: number) => any,
) {
  const c = S.chars[S.me];
  const m = MEMBERS[S.me];
  if (!c || !m) return;

  // ── Ren beräkning (ingen mutation) ──────────────────────────────
  const result = calcAwardXP(c, m, q, xpEarned, S.me);
  const {
    totalXP, milestone, workPts, milestoneWorkBonus,
    newStreak, newLevel, newXp, newXpToNext,
    leveled, statInc, feedAction,
  } = result;

  // ── Side-effects: applicera resultat på S ───────────────────────

  // Streak
  c.streak        = newStreak;
  c.lastQuestDate = Date.now();
  c.lastSeen      = Date.now();

  // Streak milestone notifikationer
  const streakMilestones = [5, 10, 14, 30];
  if (streakMilestones.includes(c.streak)) {
    try {
      const { createStreakNotif, addNotifToAll: addToAll } = await import('../state/notifications.js');
      const { MEMBERS: MBR } = await import('../data/members.js');
      const memberName = MBR[S.me]?.name || S.me;
      addToAll(createStreakNotif(S.me, memberName, c.streak));
    } catch {}
  }

  // XP och level
  c.xp         = newXp;
  c.level      = newLevel;
  c.xpToNext   = newXpToNext;
  c.totalXp    = (c.totalXp || 0) + totalXP;
  c.questsDone = (c.questsDone || 0) + 1;

  // Level-up notifikation + push
  if (leveled) {
    const memberName = MEMBERS[S.me]?.name || S.me;
    addNotifToAll(createLevelUpNotif(S.me, memberName, c.level));
    sendPush(
      `${memberName} gick upp till Level ${c.level}`,
      `Nytt level uppnått i Sektionen HQ 🎯`,
      S.me,
      '/'
    );
  }

  // Karaktärs-stats
  c.stats         = c.stats         || { vit: 10, wis: 10, for: 10, cha: 10 };
  c.categoryCount = c.categoryCount || {};
  c.categoryCount[q.cat] = (c.categoryCount[q.cat] || 0) + 1;
  Object.entries(statInc).forEach(([stat, inc]) => {
    c.stats[stat] = Math.min(100, (c.stats[stat] || 10) + inc);
  });

  // Arbetspoäng
  c.pts = c.pts || { work: 0, spotify: 0, social: 0, bonus: 0 };
  c.pts.work += workPts;
  if (milestoneWorkBonus > 0) c.pts.bonus += milestoneWorkBonus;

  // Form-tracker (senaste 5 completions)
  c.form = c.form || [];
  c.form.push('W');
  if (c.form.length > 5) c.form.shift();

  // Quest-status — markera done om recur:'none'
  const questIdx = S.quests.findIndex(sq => sq.id === q.id);
  if (questIdx !== -1 && S.quests[questIdx].recur === 'none') {
    S.quests[questIdx].done = true;
    /* ── temporalBehavior tracking ── */
    const _tq = S.quests[questIdx];
    if (_tq?.deadline) {
      const totalWindow = _tq.deadline - (_tq.createdAt || (_tq.deadline - 7 * 86400000));
      const remaining   = _tq.deadline - Date.now();
      const urgency     = Math.max(0, Math.min(1, 1 - remaining / totalWindow));

      if (!S.chars[S.me].temporalBehavior) {
        S.chars[S.me].temporalBehavior = { history: [], pattern: 'unknown', avgUrgency: 0.5, anomaly: false };
      }
      const tb = S.chars[S.me].temporalBehavior;
      tb.history = [...(tb.history || []), urgency].slice(-20);
      const avg  = tb.history.reduce((a, b) => a + b, 0) / tb.history.length;
      tb.avgUrgency  = avg;
      tb.pattern     = avg < 0.35 ? 'early' : avg > 0.7 ? 'deadline-driven' : 'steady';
      tb.anomaly     = Math.abs(urgency - avg) > 0.4;
      tb.lastUpdated = Date.now();
    }
  }
  // Recurring quests: QuestCard ansvarar för att återaktivera kortet via setTimeout

  // Activity feed
  const ts = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  S.feed = S.feed || [];
  S.feed.unshift({ who: S.me, action: feedAction, ts });
  if (S.feed.length > 50) S.feed.length = 50;

  // Push-notis: quest slutfört
  sendPush(
    `${m.name || S.me} slutförde ett uppdrag`,
    `"${q.title}" — +${totalXP} XP`,
    S.me,
    '/'
  );

  // Belöning (valfri)
  if (rollReward) {
    const reward = rollReward(totalXP);
    if (reward && showRW) showRW(reward);
  }

  // Level-up overlay
  if (leveled && showLU) showLU(c.level);

  // Floating XP-text
  if (showXPPop) showXPPop(totalXP, event);

  save();
  notify();
}

// ── Övriga exporterade funktioner ───────────────────────────────

/**
 * awardMetricPts(memberId, pts, type)
 * Ger poäng direkt till ett specifikt poängfält (spotify, social, bonus).
 */
export function awardMetricPts(memberId, pts, type = 'bonus') {
  const c = S.chars[memberId];
  if (!c) return;
  c.pts = c.pts || { work: 0, spotify: 0, social: 0, bonus: 0 };
  c.pts[type] = (c.pts[type] || 0) + pts;
  save();
  notify();
}

/**
 * awardInsightBonus(questId, insight, questTitle)
 *
 * Tilldelar +15 XP för en skriven insikt efter quest-genomförande.
 * Extraherat från QuestCompleteModal för att hålla XP-logik utanför UI.
 */
export function awardInsightBonus(questId, insight, questTitle) {
  if (!insight || !insight.trim()) return;
  const q = S.quests.find(q => q.id === questId);
  if (!q) return;

  q.insight = insight;
  S.chars[S.me].xp      = (S.chars[S.me].xp      || 0) + 15;
  S.chars[S.me].totalXp = (S.chars[S.me].totalXp || 0) + 15;
  S.feed.unshift({
    who:    S.me,
    action: `reflekterade över "${questTitle}" 💡`,
    xp:     15,
    time:   new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
  });
  save();
}

/**
 * completeCollaborativeQuest(q, participants, xpEarned)
 * Delar ut XP till alla deltagare med kollaborativ multiplikator.
 */
export async function completeCollaborativeQuest(q, participants, xpEarned) {
  const multiplier = calcCollaborativeBonus(participants.length);
  const boostedXP  = Math.round(xpEarned * multiplier);
  for (const memberId of participants) {
    const c = S.chars[memberId];
    if (!c) continue;
    const roleScaled = calcQuestXP(memberId, boostedXP);
    c.xp      = (c.xp      || 0) + roleScaled;
    c.totalXp = (c.totalXp || 0) + roleScaled;
    c.questsDone = (c.questsDone || 0) + 1;
    c.xpToNext = c.xpToNext || xpForLevel(c.level || 1);
    while (c.xp >= c.xpToNext) {
      c.xp      -= c.xpToNext;
      c.level    = (c.level || 1) + 1;
      c.xpToNext = xpForLevel(c.level);
    }
  }
  save();
  notify();
}
