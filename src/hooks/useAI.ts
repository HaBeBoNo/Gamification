// ═══════════════════════════════════════════════════════════════
// useAI.ts — Orchestrering av AI-flöden för Sektionen
//
// Ansvarsfördelning:
//   src/lib/claudeApi.ts  — HTTP-klient, parseJSON, ts()
//   src/lib/aiPrompts.js  — Alla promptmallar och coach-identiteter
//   src/hooks/useAI.ts    — Spellogik: state-mutationer, save(), notify()
// ═══════════════════════════════════════════════════════════════

import { S, save, notify } from '../state/store';
import { MEMBERS } from '../data/members';
import { awardXP } from './useXP';
import { callClaude, parseJSON } from '../lib/claudeApi';
import {
  buildValidatePrompt,
  buildQuestGenPrompt,
  buildCoachPrompt,
  buildGhostPrompt,
  buildSidequestPrompt,
} from '../lib/aiPrompts';
import type { Quest } from '../types/game';

// Re-export constants that components already import from this file
export { DEFAULT_COACH_NAMES, WELCOME_MESSAGES, buildCoachPrompt } from '../lib/aiPrompts';

// ── Typer för UI-callbacks ────────────────────────────────────────

type ShowLU      = (level: number) => void;
type ShowRW      = (reward: unknown, tier?: string) => void;
type ShowXPPop   = (xp: number, event: MouseEvent | null) => void;
type RollReward  = (xp: number) => unknown | null;

interface SidequestSuggestion {
  title: string;
  desc:  string;
  cat:   string;
  xp:    number;
}

// ── Exporterade orchestrerings-funktioner ─────────────────────────

/**
 * aiValidate(q, desc, event, showLU, showRW, showXPPop, rollReward)
 * Validerar ett quest-svar via AI och tilldelar XP proportionellt mot score.
 */
export async function aiValidate(
  q:           Quest,
  desc:        string,
  event:       MouseEvent | null,
  showLU?:     ShowLU,
  showRW?:     ShowRW,
  showXPPop?:  ShowXPPop,
  rollReward?: RollReward,
): Promise<void> {
  const m = (MEMBERS as Record<string, unknown>)[S.me!];
  const c = S.chars[S.me!];
  if (!m || !c) return;

  const questIdx = S.quests.findIndex(sq => sq.id === q.id);
  if (questIdx !== -1) S.quests[questIdx].aiThinking = true;
  notify();

  try {
    const txt      = await callClaude(buildValidatePrompt(m, c, q, desc) as string, 150);
    const score    = parseInt(txt.match(/SCORE:(\d+)/)?.[1]  || '50', 10);
    const verdict  = txt.match(/VERDICT:(accepted|partial|rejected)/)?.[1] || 'partial';
    const feedback = txt.match(/FEEDBACK:(.+)/)?.[1]?.trim() || 'Noterat.';
    const xpEarned = Math.round(q.xp * (score / 100));

    const cls = verdict === 'accepted' ? 'v-accepted'
              : verdict === 'partial'  ? 'v-partial'
              : 'v-rejected';

    if (questIdx !== -1) {
      S.quests[questIdx].aiThinking = false;
      S.quests[questIdx].aiVerdict  = { text: `${feedback} — ${score}/100 → ${xpEarned} XP`, cls };
    }
    notify();

    if (verdict !== 'rejected' && xpEarned > 0) {
      setTimeout(() => awardXP(q, xpEarned, event, showLU, showRW, showXPPop, rollReward), 1200);
    }
  } catch {
    if (questIdx !== -1) {
      S.quests[questIdx].aiThinking = false;
      S.quests[questIdx].aiVerdict  = { text: 'AI ej tillgänglig — halvt XP tilldelat', cls: 'v-partial' };
    }
    notify();
    setTimeout(() => awardXP(q, Math.round(q.xp * 0.5), event, showLU, showRW, showXPPop, rollReward), 800);
  }
}

/**
 * generatePersonalQuests(refreshMode)
 * Genererar 4 personliga AI-quests och lägger till dem i S.quests.
 */
export async function generatePersonalQuests(refreshMode = false): Promise<void> {
  const m = (MEMBERS as Record<string, unknown>)[S.me!];
  const c = S.chars[S.me!];
  if (!m || !c) return;

  try {
    const txt    = await callClaude(buildQuestGenPrompt(m, c, refreshMode) as string, 700);
    const parsed = parseJSON<Array<Partial<Quest>>>(txt);

    if (refreshMode) {
      S.quests = S.quests.filter(q =>
        !(q.owner === S.me && q.personal && q.type !== 'ghost' && q.done)
      );
    }

    let nextId = Math.max(400, ...S.quests.map(q => (q.id as number) || 0)) + 1;
    parsed.forEach(q => {
      S.quests.push({
        id:        nextId++,
        owner:     S.me!,
        title:     q.title || '',
        desc:      q.desc  || '',
        cat:       q.cat   || 'wisdom',
        xp:        q.xp    || 50,
        stars:     '',
        region:    '🌐 Personal',
        recur:     'none',
        type:      q.type  || 'standard',
        done:      false,
        aiVerdict: null,
        personal:  true,
      });
    });

    const newTitles = parsed.map(q => q.title || '');
    S.chars[S.me!].generatedHistory = [
      ...(S.chars[S.me!].generatedHistory || []),
      ...newTitles,
    ].slice(-20);
  } catch {
    S.quests.push({
      id:        401,
      owner:     S.me!,
      title:     `${(MEMBERS as Record<string, { name?: string }>)[S.me!]?.name}: en sak den här veckan`,
      desc:      'Baserat på din rollkalibrering — välj den enda saken som faktiskt spelar roll att göra nu.',
      cat:       'wisdom',
      xp:        75,
      stars:     '',
      region:    '🌐 Personal',
      recur:     'none',
      type:      'strategic',
      done:      false,
      aiVerdict: null,
      personal:  true,
    });
  }

  save();
}

/**
 * refreshCoach()
 * Hämtar en personlig coaching-insikt och returnerar texten som sträng.
 */
export async function refreshCoach(): Promise<string> {
  if (!S.me || !S.chars[S.me]) return 'Laddar din profil...';
  try {
    return await callClaude(buildCoachPrompt(S.me) as string, 200);
  } catch {
    return 'Håll ut. Det du bygger nu syns inte ännu — men det spelar roll.';
  }
}

/**
 * checkGhostQuest()
 * Kontrollerar om ghost quest ska triggas (7 dagars quest-inaktivitet).
 */
export async function checkGhostQuest(): Promise<void> {
  const c = S.chars[S.me!];
  const m = (MEMBERS as Record<string, unknown>)[S.me!];
  if (!c || !m) return;

  const lastQuestDate = (c.lastQuestDate as number | undefined)
    || (c.lastSeen as number)
    || (Date.now() - 8 * 24 * 60 * 60 * 1000);
  const daysSince = (Date.now() - lastQuestDate) / (1000 * 60 * 60 * 24);

  if (daysSince < 7) return;
  if (S.quests.some(q => q.owner === S.me && q.type === 'ghost' && !q.done)) return;

  let ghostData: Partial<Quest>;
  try {
    const txt = await callClaude(buildGhostPrompt(m, c, daysSince) as string, 200);
    ghostData = parseJSON<Partial<Quest>>(txt);
  } catch {
    ghostData = {
      title: 'Välkommen tillbaka — vad har du gjort?',
      desc:  'Du var borta ett tag. Registrera din insats retroaktivt och ta XP för det du faktiskt bidragit med.',
      cat:   'wisdom',
      xp:    75,
    };
  }

  S.quests.push({
    id:        900 + Math.floor(Math.random() * 99),
    owner:     S.me!,
    title:     ghostData.title || 'Vad hände den senaste veckan?',
    desc:      ghostData.desc  || 'Du har jobbat. Systemet vet inte vad. Berätta.',
    cat:       ghostData.cat   || 'wisdom',
    xp:        ghostData.xp   || 75,
    stars:     '👻',
    region:    '🌐 Personal',
    recur:     'none',
    type:      'ghost',
    done:      false,
    aiVerdict: null,
    personal:  true,
  });

  save();
}

/**
 * showSidequestNudge(weekKey)
 * Genererar 3 sidequest-förslag och returnerar dem som array.
 */
export async function showSidequestNudge(_weekKey?: string): Promise<SidequestSuggestion[]> {
  const m = (MEMBERS as Record<string, unknown>)[S.me!];
  const c = S.chars[S.me!];

  const fallbacks: SidequestSuggestion[] = [
    { title: 'Spela utan mål',      desc: 'Ta upp instrumentet och spela vad som kommer. Ingen agenda.',   cat: 'health', xp: 25 },
    { title: 'Kreativt fragment',   desc: 'Skriv ett vers, ett riff eller en melodi. Bara ett fragment.',  cat: 'wisdom', xp: 35 },
    { title: 'Ring någon i bandet', desc: 'Prata musik med ett bandmedlem — inte planering, bara musik.',  cat: 'global', xp: 25 },
  ];

  if (!m || !c) return fallbacks;

  try {
    const txt    = await callClaude(buildSidequestPrompt(m, c) as string, 400);
    const parsed = parseJSON<SidequestSuggestion[]>(txt);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallbacks;
  } catch {
    return fallbacks;
  }
}
