// ═══════════════════════════════════════════════════════════════
// useXP.test.js — Vitest-tester för XP-logik
// Testar: calcQuestXP, awardXP, awardMetricPts
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock localStorage + zustand INNAN import ──────────────────
const storage = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => storage[k] ?? null,
  setItem: (k, v) => { storage[k] = v; },
  removeItem: (k) => { delete storage[k]; },
});

// ── Importera efter mocking ──────────────────────────────────
import { calcQuestXP, awardXP, awardMetricPts } from './useXP';
import { S, save, defChar } from '../state/store';
import { ROLE_TYPES } from '../data/members';

// ── Hjälpfunktion: sätt upp testmiljö ─────────────────────────
function setupMember(id = 'hannes', overrides = {}) {
  S.me = id;
  S.chars[id] = { ...defChar(id), ...overrides };
  S.quests = [];
  S.feed = [];
}

function makeQuest(overrides = {}) {
  return {
    id: 100,
    title: 'Testquest',
    desc: 'En test',
    cat: 'wisdom',
    xp: 100,
    recur: 'none',
    type: 'standard',
    region: '🌐 Personal',
    done: false,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// calcQuestXP
// ═══════════════════════════════════════════════════════════════

describe('calcQuestXP', () => {
  it('skalar XP med amplifier-multiplikator (1.0)', () => {
    const xp = calcQuestXP('hannes', 100);
    expect(xp).toBe(Math.round(100 * (ROLE_TYPES.amplifier.xpScaling)));
    expect(xp).toBe(100);
  });

  it('skalar XP med enabler-multiplikator (1.15)', () => {
    const xp = calcQuestXP('martin', 100);
    expect(xp).toBe(Math.round(100 * 1.15));
    expect(xp).toBe(115);
  });

  it('skalar XP med builder-multiplikator (1.1)', () => {
    const xp = calcQuestXP('ludvig', 100);
    expect(xp).toBe(Math.round(100 * 1.1));
    expect(xp).toBe(110);
  });

  it('hanterar okänd member gracefully (fallback 1.0)', () => {
    const xp = calcQuestXP('unknown_person', 100);
    expect(xp).toBe(100);
  });

  it('hanterar noll-XP', () => {
    expect(calcQuestXP('hannes', 0)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// awardXP — basic flow
// ═══════════════════════════════════════════════════════════════

describe('awardXP', () => {
  beforeEach(() => {
    setupMember('hannes', { level: 1, xp: 0, xpToNext: 100, totalXp: 0, questsDone: 0, streak: 0 });
  });

  it('ökar XP och questsDone', () => {
    const q = makeQuest();
    awardXP(q, 50, null);

    const c = S.chars.hannes;
    expect(c.totalXp).toBeGreaterThan(0);
    expect(c.questsDone).toBe(1);
  });

  it('returnerar totalXP och level-info', () => {
    const q = makeQuest();
    const result = awardXP(q, 50, null);

    expect(result).toHaveProperty('totalXP');
    expect(result).toHaveProperty('leveled');
    expect(result).toHaveProperty('level');
    expect(result.totalXP).toBeGreaterThanOrEqual(50);
  });

  it('genererar feed-entry', () => {
    const q = makeQuest({ title: 'Testfeed' });
    awardXP(q, 50, null);

    expect(S.feed.length).toBeGreaterThanOrEqual(1);
    expect(S.feed[0].who).toBe('hannes');
    expect(S.feed[0].action).toContain('Testfeed');
  });

  it('markerar quest som done vid recur:none', () => {
    const q = makeQuest({ id: 200, recur: 'none' });
    S.quests.push({ ...q });
    awardXP(q, 50, null);

    expect(S.quests[0].done).toBe(true);
  });

  it('ökar kategori-stat (wisdom → wis)', () => {
    const q = makeQuest({ cat: 'wisdom' });
    const before = S.chars.hannes.stats.wis;
    awardXP(q, 50, null);
    expect(S.chars.hannes.stats.wis).toBe(before + 1);
  });

  it('tech ger +2 wis', () => {
    const q = makeQuest({ cat: 'tech' });
    const before = S.chars.hannes.stats.wis;
    awardXP(q, 50, null);
    expect(S.chars.hannes.stats.wis).toBe(before + 2);
  });

  it('global ger +1 cha och +1 for', () => {
    const q = makeQuest({ cat: 'global' });
    const chaBefore = S.chars.hannes.stats.cha;
    const forBefore = S.chars.hannes.stats.for;
    awardXP(q, 50, null);
    expect(S.chars.hannes.stats.cha).toBe(chaBefore + 1);
    expect(S.chars.hannes.stats.for).toBe(forBefore + 1);
  });
});

// ═══════════════════════════════════════════════════════════════
// awardXP — level-up
// ═══════════════════════════════════════════════════════════════

describe('awardXP — level-up', () => {
  beforeEach(() => {
    setupMember('hannes', { level: 1, xp: 90, xpToNext: 100, totalXp: 90, questsDone: 5, streak: 0 });
  });

  it('levlar upp vid tillräcklig XP', () => {
    const q = makeQuest();
    const result = awardXP(q, 50, null);

    expect(result.leveled).toBe(true);
    expect(S.chars.hannes.level).toBeGreaterThanOrEqual(2);
  });

  it('ökar alla stats med +1 vid level-up', () => {
    const statsBefore = { ...S.chars.hannes.stats };
    const q = makeQuest();
    awardXP(q, 50, null);

    // Minst +1 från level-up, potentiellt +1 mer från quest-kategori
    Object.keys(statsBefore).forEach(k => {
      expect(S.chars.hannes.stats[k]).toBeGreaterThanOrEqual(statsBefore[k] + 1);
    });
  });

  it('genererar level-up feed entry', () => {
    const q = makeQuest();
    awardXP(q, 50, null);

    const levelFeed = S.feed.find(f => f.action.includes('leveled up'));
    expect(levelFeed).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// awardXP — streak
// ═══════════════════════════════════════════════════════════════

describe('awardXP — streak', () => {
  it('startar streak vid 1 om ingen tidigare quest-datum', () => {
    setupMember('hannes', { streak: 0, lastQuestDate: 0 });
    awardXP(makeQuest(), 50, null);
    expect(S.chars.hannes.streak).toBe(1);
  });

  it('inkrementerar streak om senaste quest var igår', () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    setupMember('hannes', { streak: 3, lastQuestDate: yesterday });
    awardXP(makeQuest(), 50, null);
    expect(S.chars.hannes.streak).toBe(4);
  });

  it('behåller streak om senaste quest var idag', () => {
    setupMember('hannes', { streak: 5, lastQuestDate: Date.now() - 1000 });
    awardXP(makeQuest(), 50, null);
    expect(S.chars.hannes.streak).toBe(5);
  });

  it('återställer streak vid gap > 1 dag', () => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    setupMember('hannes', { streak: 10, lastQuestDate: threeDaysAgo });
    awardXP(makeQuest(), 50, null);
    expect(S.chars.hannes.streak).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// awardXP — milestone bonus
// ═══════════════════════════════════════════════════════════════

describe('awardXP — milestone bonus', () => {
  beforeEach(() => {
    setupMember('hannes', { streak: 0 });
  });

  it('ger milestone-bonus för quest med baseXP >= 150', () => {
    const q = makeQuest({ xp: 200 });
    const result = awardXP(q, 200, null);
    // amplifier milestone = 10
    // Total = round(200 * 1.0 * (1 + 0)) + 10 = 210
    expect(result.totalXP).toBe(210);
  });

  it('ger ingen milestone-bonus för quest med baseXP < 150', () => {
    const q = makeQuest({ xp: 100 });
    const result = awardXP(q, 100, null);
    // Total = round(100 * 1.0 * 1.0) + 0 = 100
    expect(result.totalXP).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════
// awardXP — work points
// ═══════════════════════════════════════════════════════════════

describe('awardXP — work points', () => {
  beforeEach(() => {
    setupMember('hannes', { streak: 0 });
  });

  it('tilldelar work points baserat på quest-XP', () => {
    const q = makeQuest({ xp: 100 });
    awardXP(q, 100, null);
    // workPts = round(100 * 0.5 * 1.0) = 50
    expect(S.chars.hannes.pts.work).toBe(50);
  });

  it('Japan-bonus ökar work points med 1.5x', () => {
    const q = makeQuest({ xp: 100, region: '🇯🇵 Japan' });
    awardXP(q, 100, null);
    // workPts = round(round(100 * 0.5 * 1.0) * 1.5) = round(50 * 1.5) = 75
    expect(S.chars.hannes.pts.work).toBe(75);
  });
});

// ═══════════════════════════════════════════════════════════════
// awardMetricPts
// ═══════════════════════════════════════════════════════════════

describe('awardMetricPts', () => {
  beforeEach(() => {
    setupMember('hannes', { pts: { work: 0, spotify: 0, social: 0, bonus: 0 } });
  });

  it('tilldelar spotify-poäng för spf-ökning', () => {
    awardMetricPts('hannes', { spf: 100, str: 0, ig: 0, x: 0, tix: 0 });
    expect(S.chars.hannes.pts.spotify).toBe(10);
  });

  it('tilldelar social-poäng för ig-ökning', () => {
    awardMetricPts('hannes', { spf: 0, str: 0, ig: 50, x: 0, tix: 0 });
    expect(S.chars.hannes.pts.social).toBe(5);
  });

  it('tilldelar bonus-poäng för tix-ökning', () => {
    awardMetricPts('hannes', { spf: 0, str: 0, ig: 0, x: 0, tix: 10 });
    expect(S.chars.hannes.pts.bonus).toBe(10);
  });

  it('ignorerar negativa deltas', () => {
    awardMetricPts('hannes', { spf: -50, str: -1000, ig: -10, x: -5, tix: -2 });
    expect(S.chars.hannes.pts.spotify).toBe(0);
    expect(S.chars.hannes.pts.social).toBe(0);
    expect(S.chars.hannes.pts.bonus).toBe(0);
  });
});
