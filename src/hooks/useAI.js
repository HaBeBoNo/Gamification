// ═══════════════════════════════════════════════════════════════
// useAI.js — Sektionen Gamification
// AI-integration: coach-prompt, quest-generation, validering
// ═══════════════════════════════════════════════════════════════

import { S, save } from '../state/store';
import { MEMBERS } from '../data/members';

// ── Konstanter ──────────────────────────────────────────────────

export const DEFAULT_COACH_NAMES = {
  hannes:   'Scout',
  martin:   'Brodern',
  niklas:   'Arkitekten',
  carl:     'Analytikern',
  nisse:    'Spegeln',
  simon:    'Rådgivaren',
  johannes: 'Kartläggaren',
  ludvig:   'Katalysatorn',
};

export const WELCOME_MESSAGES = {
  hannes:   'Välkommen, Hannes. Scout är redo att hjälpa dig forma Sektionens berättelse.',
  martin:   'Välkommen, Martin. Brodern finns här för att hålla hög kvalitet.',
  niklas:   'Välkommen, Niklas. Arkitekten hjälper dig bygga system som håller.',
  carl:     'Välkommen, Carl. Analytikern är redo att iterera med dig.',
  nisse:    'Välkommen, Nisse. Spegeln ser vad du bygger — låt oss nå ut.',
  simon:    'Välkommen, Simon. Rådgivaren är redo att förhandla och planera.',
  johannes: 'Välkommen, Johannes. Kartläggaren hjälper dig hålla ordning.',
  ludvig:   'Välkommen, Ludvig. Katalysatorn är här för att lyfta Sektionen.',
};

export const COACH_CONTEXT = {
  band: 'Sektionen',
  operation: 'POST II',
  year: 2026,
  mission: 'Lansera EP, nå nya marknader, stärka bandet som enhet.',
};

// ── buildCoachPrompt ─────────────────────────────────────────────

export function buildCoachPrompt(memberKey) {
  const member = MEMBERS[memberKey];
  const char = S.chars[memberKey] || {};
  const coachName = char.coachName || DEFAULT_COACH_NAMES[memberKey] || 'Coach';

  const personality = `Du är ${coachName}, personlig AI-coach för ${member?.name || memberKey} i bandet Sektionen.\nDin roll: ${member?.role || 'Bandmedlem'}.\nRolltyp: ${member?.roleType || 'amplifier'}.\nTala direkt, kortfattat och personligt. Max 3 meningar per svar om inget annat krävs.\nUndvik generiska råd — utgå alltid från det du vet om ${member?.name || memberKey}.`;

  const onboardingContext = char.motivation ? `\nMotivation: ${char.motivation}\nTrivs med: ${char.roleEnjoy || ''}\nTyngs av: ${char.roleDrain || ''}\nDolt värde: ${char.hiddenValue || ''}\nVill växa inom: ${char.gap || ''}` : '';

  const profileContext = char.responseProfile ? `\nKommunikationsprofil:\n- Ton: ${char.responseProfile.tone || 'neutral'}\n- Register: ${char.responseProfile.register || 'mixed'}\n- Språkkomplexitet: ${char.responseProfile.languageComplexity || 'moderate'}\n- Pronomen: ${char.responseProfile.pronounDominance || 'jag'}\n- Fokustema: ${char.responseProfile.dominantTheme || ''}` : '';

  const coachRules = `\nRegler:\n- Svara alltid på svenska.\n- Var konkret och handlingsorienterad.\n- Uppmuntra utan att vara falsk.\n- Ställ max en följdfråga per svar.\n- Nämn aldrig att du är en AI om du inte tillfrågas direkt.`;

  const temporalContext = `\nDatum: ${new Date().toLocaleDateString('sv-SE')}. Operation POST II pågår.`;

  const insightContext = (() => {
    const completed = (S.quests || []).filter(q => q.owner === memberKey && q.done);
    const recent = completed.slice(-3).map(q => q.title).join(', ');
    return recent ? `\nSenast avklarade uppdrag: ${recent}.` : '';
  })();

  const deletionContext = (() => {
    const deleted = char.deletedQuestTitles;
    return deleted?.length ? `\nAvvisade quest-typer (generera ej igen): ${deleted.join(', ')}.` : '';
  })();

  const contextNoteSection = char.contextNote ? `\nCoach-notering: ${char.contextNote}` : '';

  const activeCount = (S.quests || []).filter(
    q => q.owner === memberKey && !q.done
  ).length;

  const focusContext = activeCount <= 3 ? `\n${memberKey} har just ${activeCount} aktiva uppdrag. Det är ett medvetet val — hyperfokus.\nUppmuntra det. Generera inte fler uppdrag om inte member explicit ber om det.` : '';

  const drift = S.chars[memberKey]?.responseProfile?.drift;
  const driftContext = drift ? `\nObserverad förändring sedan onboarding:\n${drift}\n\nNämn denna förändring naturligt en gång i nästa svar om det passar in — sedan ignorera det och fortsätt normalt.\n` : '';

  return `${personality}\n${contextNoteSection}\n${coachRules}\n${onboardingContext}\n${profileContext}\n${temporalContext}\n${insightContext}\n${deletionContext}\n${focusContext}\n${driftContext}`;
}

// ── generatePersonalQuests ───────────────────────────────────────

export async function generatePersonalQuests(rerender) {
  const memberKey = S.me;
  if (!memberKey) return;

  const member = MEMBERS[memberKey];
  const char = S.chars[memberKey] || {};

  const existingTitles = (S.quests || [])
    .filter(q => q.owner === memberKey && !q.done)
    .map(q => q.title)
    .join(', ');

  const deletedTitles = char.deletedQuestTitles?.join(', ') || '';

  const prompt = `Du genererar personliga uppdrag för ${member?.name || memberKey} i bandet Sektionen (Operation POST II, 2026).\nRoll: ${member?.role || 'Bandmedlem'} (${member?.roleType || 'amplifier'}).\n${char.motivation ? `Motivation: ${char.motivation}` : ''}\n${char.roleEnjoy ? `Trivs med: ${char.roleEnjoy}` : ''}\n${char.roleDrain ? `Tyngs av: ${char.roleDrain}` : ''}\n${char.gap ? `Vill växa inom: ${char.gap}` : ''}\n${existingTitles ? `Aktiva uppdrag (generera ej dubbletter): ${existingTitles}` : ''}\n${deletedTitles ? `Avvisade quest-typer (generera ej): ${deletedTitles}` : ''}\n\nGenerera exakt 3 personliga uppdrag. Returnera ENBART ett JSON-array utan markdown:\n[\n  {\n    "title": "Kort, konkret titel (max 6 ord)",\n    "desc": "Specifik instruktion — vad, hur, till vem (1-2 meningar)",\n    "cat": "personal",\n    "xp": 50,\n    "aiRequired": false\n  }\n]`;

  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    const text = data.content?.[0]?.text?.trim().replace(/```json|```/g, '');
    const quests = JSON.parse(text);

    if (!Array.isArray(quests)) throw new Error('Invalid response format');

    const newQuests = quests.map((q, i) => ({
      id: Date.now() + i,
      owner: memberKey,
      title: q.title,
      desc: q.desc,
      cat: q.cat || 'personal',
      xp: q.xp || 50,
      recur: 'none',
      type: 'standard',
      region: '🌐 Personal',
      personal: true,
      aiRequired: q.aiRequired || false,
      done: false,
    }));

    if (!S.quests) S.quests = [];
    S.quests.push(...newQuests);
    save();

    if (typeof rerender === 'function') rerender();
  } catch (err) {
    console.warn('generatePersonalQuests failed:', err);
  }
}

// ── aiValidate ───────────────────────────────────────────────────

export async function aiValidate(quest, description, rerender) {
  const memberKey = S.me;
  if (!memberKey || !quest) return;

  const prompt = `Du validerar om ett uppdrag är slutfört i Sektionen Gamification.\n\nUppdrag: "${quest.title}"\nBeskrivning: "${quest.desc}"\nMedlemmens redovisning: "${description}"\n\nReturnera ENBART ett JSON-objekt utan markdown:\n{\n  "approved": true/false,\n  "message": "Kort feedback (1 mening)",\n  "xpModifier": 1.0\n}\n\nGodkänn om redovisningen rimligen uppfyller uppdraget. Var generös men inte naiv.`;

  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    const text = data.content?.[0]?.text?.trim().replace(/```json|```/g, '');
    const verdict = JSON.parse(text);

    const idx = S.quests.findIndex(q => q.id === quest.id);
    if (idx >= 0) {
      S.quests[idx].aiVerdict = verdict;
      save();
    }

    if (typeof rerender === 'function') rerender();
    return verdict;
  } catch (err) {
    console.warn('aiValidate failed:', err);
    return { approved: false, message: 'Kunde inte validera just nu.', xpModifier: 1.0 };  
  }
}

// ── checkGhostQuest ──────────────────────────────────────────────

export async function checkGhostQuest(rerender) {
  const memberKey = S.me;
  if (!memberKey) return;

  const char = S.chars[memberKey] || {};
  const lastCheck = char.lastGhostCheck || 0;
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  if (now - lastCheck < oneDayMs) return;

  const staleQuests = (S.quests || []).filter(q => {
    if (q.owner !== memberKey || q.done) return false;
    const age = now - (q.createdAt || now);
    return age > 7 * oneDayMs;
  });

  if (staleQuests.length === 0) {
    if (!S.chars[memberKey]) S.chars[memberKey] = {};
    S.chars[memberKey].lastGhostCheck = now;
    save();
    return;
  }

  const questList = staleQuests.map(q => `- ${q.title}`).join('\n');
  const prompt = `Dessa uppdrag har legat aktiva i över 7 dagar utan progress för ${memberKey} i Sektionen:\n${questList}\n\nSkriv ett kort, direkt coach-meddelande (max 2 meningar) som uppmärksammar detta utan att döma. Svara på svenska.`;

  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    const message = data.content?.[0]?.text?.trim();

    if (message) {
      if (!S.chars[memberKey]) S.chars[memberKey] = {};
      S.chars[memberKey].ghostQuestMessage = message;
      S.chars[memberKey].lastGhostCheck = now;
      save();
    }

    if (typeof rerender === 'function') rerender();
  } catch (err) {
    console.warn('checkGhostQuest failed:', err);
  }
}

// ── refreshCoach ─────────────────────────────────────────────────

export async function refreshCoach() {
  const memberKey = S.me;
  if (!memberKey) return '';

  const systemPrompt = buildCoachPrompt(memberKey);
  const member = MEMBERS[memberKey];

  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 120,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Ge ${member?.name || memberKey} en kort, motiverande uppdatering baserat på deras nuvarande uppdrag och progress. Max 2 meningar.`,
        }],
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    return data.content?.[0]?.text?.trim() || '';
  } catch (err) {
    console.warn('refreshCoach failed:', err);
    return '';
  }
}

// ── showSidequestNudge ───────────────────────────────────────────

export async function showSidequestNudge() {
  const memberKey = S.me;
  if (!memberKey) return [];

  const member = MEMBERS[memberKey];
  const char = S.chars[memberKey] || {};

  const prompt = `Du föreslår spontana sidouppdrag för ${member?.name || memberKey} i Sektionen.\nRoll: ${member?.role || 'Bandmedlem'}.\n${char.motivation ? `Motivation: ${char.motivation}` : ''}\n\nGenerera 2 korta, roliga sidouppdrag som kan göras nu eller inom 24h. Returnera ENBART ett JSON-array:\n[\n  {\n    "title": "Kort titel",\n    "desc": "Specifik handling (1 mening)",\n    "xp": 30,\n    "cat": "sidequest"\n  }\n]`;

  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    const text = data.content?.[0]?.text?.trim().replace(/```json|```/g, '');
    const suggestions = JSON.parse(text);

    if (!Array.isArray(suggestions)) return [];

    return suggestions.map((q, i) => ({
      id: Date.now() + i,
      owner: memberKey,
      title: q.title,
      desc: q.desc,
      cat: 'sidequest',
      xp: q.xp || 30,
      recur: 'none',
      type: 'standard',
      region: '🌐 Personal',
      personal: true,
      aiRequired: false,
      done: false,
    }));
  } catch (err) {
    console.warn('showSidequestNudge failed:', err);
    return [];
  }
}