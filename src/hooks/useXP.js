import { S, save, xpForLevel, rand, now, defChar } from '../state/store';
import { MEMBERS, ROLE_TYPES } from '../data/members';
import { REWARDS } from '../data/rewards';

export function roleTypeTag(memberId) {
  const rt = S.chars[memberId]?.roleType || MEMBERS[memberId]?.roleType || 'amplifier';
  return ROLE_TYPES[rt] || ROLE_TYPES.amplifier;
}

export function calcQuestXP(memberId, baseXp) {
  const rt = roleTypeTag(memberId);
  return Math.round(baseXp * (rt.xpScaling || 1.0));
}

export function calcWorkPts(memberId, baseXp, region) {
  const rt = roleTypeTag(memberId);
  const mult = (region === 'social') ? (rt.engageMult ?? 1.0) : (rt.workMult ?? 1.0);
  return Math.round(baseXp * mult);
}

export function calcEngagePts(memberId, rawSpotify, rawSocial) {
  const rt = roleTypeTag(memberId);
  return Math.round(rawSpotify + rawSocial * (rt.engageMult ?? 1.0));
}

export function calcMilestoneBonus(memberId, baseXp) {
  const rt = roleTypeTag(memberId);
  return Math.round(baseXp * (rt.milestoneMult ?? 1.0));
}

export function awardWorkPts(memberId, xp, region) {
  const pts = calcWorkPts(memberId, xp, region);
  if (!S.chars[memberId]) return;
  if (region === 'social') {
    S.chars[memberId].pts.social = (S.chars[memberId].pts.social || 0) + pts;
  } else {
    S.chars[memberId].pts.work = (S.chars[memberId].pts.work || 0) + pts;
  }
}

export function awardMetricPts(memberId, deltas) {
  if (!S.chars[memberId]) return;
  const spotifyDelta = (deltas.spf || 0) + (deltas.str || 0) / 1000;
  const socialDelta  = (deltas.ig || 0) + (deltas.x || 0);
  const pts = calcEngagePts(memberId, Math.max(0, spotifyDelta), Math.max(0, socialDelta));
  S.chars[memberId].pts.spotify = (S.chars[memberId].pts.spotify || 0) + Math.max(0, Math.round(spotifyDelta));
  S.chars[memberId].pts.social  = (S.chars[memberId].pts.social  || 0) + Math.max(0, Math.round(socialDelta));
  S.chars[memberId].pts.bonus   = (S.chars[memberId].pts.bonus   || 0) + Math.max(0, pts);
}

function rewardTier(totalXp) {
  if (totalXp >= 2000) return 'legendary';
  if (totalXp >= 1000) return 'epic';
  if (totalXp >= 500)  return 'rare';
  if (totalXp >= 200)  return 'uncommon';
  return 'common';
}

export function showXPPop(amount, color) {
  const el = document.createElement('div');
  el.className = 'xp-pop';
  el.textContent = '+' + amount + ' XP';
  el.style.cssText = `position:fixed;top:30%;left:50%;transform:translateX(-50%);
    font-family:'Bebas Neue',sans-serif;font-size:2.5rem;color:${color || '#f0c040'};
    pointer-events:none;z-index:9999;animation:xpPop 1.5s ease forwards;`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

export function awardXP(q, xpEarned, event, _S, _save, renderAll, _showXPPop, showLU, showRW, rollReward) {
  const me = S.me;
  if (!me || !S.chars[me]) return;
  const char = S.chars[me];

  char.xp += xpEarned;
  char.totalXp += xpEarned;
  char.questsDone = (char.questsDone || 0) + 1;
  char.categoryCount = char.categoryCount || {};
  char.categoryCount[q.cat] = (char.categoryCount[q.cat] || 0) + 1;

  awardWorkPts(me, q.xp || xpEarned, q.region || 'all');

  // Level up
  let leveled = false;
  while (char.xp >= char.xpToNext) {
    char.xp -= char.xpToNext;
    char.level += 1;
    char.xpToNext = xpForLevel(char.level);
    leveled = true;
  }

  // Feed
  const feedEntry = {
    t: now(),
    text: `${MEMBERS[me]?.emoji || '⭐'} ${MEMBERS[me]?.name || me} slutförde "${q.title}" +${xpEarned} XP`,
    color: MEMBERS[me]?.xpColor || '#f0c040',
  };
  S.feed.unshift(feedEntry);
  if (S.feed.length > 50) S.feed.pop();

  save();
  if (renderAll) renderAll();
  showXPPop(xpEarned, MEMBERS[me]?.xpColor || '#f0c040');

  if (leveled && showLU) {
    showLU(char.level);
  }

  // Reward roll
  const tier = rewardTier(char.totalXp);
  const pool = REWARDS[tier] || REWARDS.common;
  const reward = rand(pool);
  if (showRW && rollReward) rollReward(reward, tier);
  else if (showRW) showRW(reward, tier);
}
