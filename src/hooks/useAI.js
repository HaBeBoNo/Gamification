// ═══════════════════════════════════════════════════════════════
// useAI.js — Anthropic API-anrop för Sektionen Gamification
// Mönster: direkt mutation av S + save() + rerender()
// Exporterar: aiValidate, generatePersonalQuests,
//             showSidequestNudge, refreshCoach, checkGhostQuest
// ═══════════════════════════════════════════════════════════════

import { S, save } from '../state/store';
import { MEMBERS, ROLE_TYPES } from '../data/members';
import { awardXP } from './useXP';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-sonnet-4-20250514';

// ── Intern hjälp ─────────────────────────────────────────────────

async function callClaude(prompt, maxTokens = 400) {
  const res = await fetch(API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: maxTokens,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

function parseJSON(raw) {
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

function ts() {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

// ── Promptar ──────────────────────────────────────────────────────

function buildValidatePrompt(m, c, q, desc) {
  return `Du är AI-coach för ${m.name} (${m.role}) i Sektionen.

Deras profil:
- Motivation: "${c.motivation || 'ej angiven'}"
- Vad de gör med glädje: "${c.roleEnjoy || 'ej angiven'}"
- Vad som kostar mer än det ger: "${c.roleDrain || 'ej angiven'}"

Quest: "${q.title}"
Quest-beskrivning: "${q.desc}"

${m.name} rapporterar: "${desc}"

Bedöm 0–100 baserat på äkthet, relevans, djup och faktisk insats. Var ärlig — inte för generös, inte för sträng.

Svara EXAKT (inget annat):
SCORE:[0-100]
VERDICT:[accepted|partial|rejected]
FEEDBACK:[en mening svenska, max 110 tecken, personlig, direkt]`;
}

function buildQuestGenPrompt(m, c, refreshMode) {
  const rtLabel = ROLE_TYPES[m.roleType]?.label || 'Amplifier';
  const rtDesc  = ROLE_TYPES[m.roleType]?.desc  || '';

  return `Du är en strategisk AI-coach för Sektionen, ett 8-personersband från Göteborg på väg mot professionell verksamhet.
${refreshMode ? 'OBS: REFRESH — personen har completat sina förra quests. Skapa nya som bygger vidare, inte samma som sist. Kontexten: Operation POST II, EP till juli, ideell → professionell.' : ''}

Styrelsemedlem: ${m.name} (${m.role})

ROLLKALIBRERING:
- Varför de spelar musik: "${c.motivation || 'ej angiven'}"
- Vad de faktiskt gör med glädje i sin roll: "${c.roleEnjoy || 'ej angiven'}"
- Vad i rollen kostar mer än det ger: "${c.roleDrain || 'ej angiven'}"
- Dold insats som ingen förväntar sig: "${c.hiddenValue || 'ej angiven'}"
- Gap de ser att ingen fyller: "${c.gap || 'ej angiven'}"

Sektionens läge: Album II ute 1 mars 2026. Operation POST II: ideell → professionell. EP till juli 2026. Individuella kanaler aktiveras. Japan X-konto aktivt.

Rolltyp: ${rtLabel} — ${rtDesc}
VIKTIGT: Anpassa strikt till rolltypen.
- amplifier: sociala medier, storytelling, synlighet OK
- enabler: INGA sociala medier-quests — infrastruktur, teknik, produktion
- builder: milstolpar och strategiska beslut — INTE dagliga aktiviteter

INSTRUKTIONER — skapa 4 personliga quests:
1. Möt dem där de faktiskt är, inte där rollbeskrivningen säger
2. Om något dränerar dem: skapa INTE quests i den kategorin
3. Bygg minst en quest kring det dolda värdet och en kring gapet
4. En av fyra ska vara type:"hidden" — icke-mätbar, personlig reflektion
5. Referera konkret till vad de skrivit — inte generiska formuleringar
6. Om personen är Ludvig: använd ALDRIG organisatoriskt språk ("din roll", "som ordförande", "ansvar"). Fokusera på impact — vad sker TACK VARE honom.
7. LEDARSKAPSSIGNAL: Om roleDrain är tomt/vagt/under 10 ord — skapa direktiva, strukturerade quests. Personen behöver riktning.

Svara EXAKT i JSON (inget annat):
[{"title":"...","desc":"...","cat":"global|social|wisdom|money|health|tech","xp":50,"type":"standard|strategic|hidden"},{"title":"...","desc":"...","cat":"...","xp":100,"type":"strategic"},{"title":"...","desc":"...","cat":"...","xp":75,"type":"standard"},{"title":"...","desc":"...","cat":"...","xp":75,"type":"hidden"}]`;
}

function buildCoachPrompt(m, c) {
  const completedCats = Object.entries(c.categoryCount || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k]) => k)
    .join(', ');

  return `Du är AI-coach för ${m.name} i Sektionen. Operation POST II: ideell → professionell. EP till juli 2026.

Rollkalibrering:
- Motivation: "${c.motivation || 'ej angiven'}"
- Vad de gör med glädje i rollen: "${c.roleEnjoy || 'ej angiven'}"
- Vad som kostar mer än det ger: "${c.roleDrain || 'ej angiven'}"
- Dold insats ingen förväntar sig: "${c.hiddenValue || 'ej angiven'}"
- Gap de ser att ingen fyller: "${c.gap || 'ej angiven'}"

Status: Level ${c.level || 1}, ${c.totalXp || 0} XP, ${c.streak || 0} dagars streak. Aktiv i: ${completedCats || 'ingen kategori ännu'}.

Ge en personlig coaching-insikt, max 2 meningar på svenska. Utgå från rollkalibreringen — inte bara motivationen. Om något dränerar dem, adressera det direkt. Ibland utmanande, ibland stöttande, alltid konkret.

VIKTIGT för Ludvig: tala aldrig om roller eller funktioner — tala alltid om vad som sker TACK VARE honom, vad han möjliggör, vad som är hans fingeravtryck på det bandet bygger.
LEDARSKAPSSIGNAL: Om roleDrain är tomt eller kortare än 10 ord — var mer direktiv och konkret. Personen behöver riktning, inte frihet.`;
}

function buildGhostPrompt(m, c, daysSince) {
  return `Du är AI-coach för ${m.name} i Sektionen, ett 8-personersband från Göteborg på väg från ideell till professionell verksamhet. Operation POST II pågår — EP till juli 2026.

${m.name} har inte loggat in på ${Math.floor(daysSince)} dagar. Det betyder inte att de inte arbetat — systemet vet bara inte vad de gjort.

Rollkalibrering:
- Vad de gör med glädje: "${c.roleEnjoy || 'ej angiven'}"
- Dold insats: "${c.hiddenValue || 'ej angiven'}"
- Rolltyp: ${m.roleType}

Skapa EN ghost quest som är ett erbjudande — inte en anklagelse. Specifik för deras rolltyp. Max 15 ord titel, max 2 meningar beskrivning. Känslan: "vi vet att du jobbat, berätta vad du gjort."

Svara EXAKT i JSON:
{"title":"...","desc":"...","cat":"global|social|wisdom|money|health|tech","xp":75}`;
}

function buildSidequestPrompt(m, c) {
  return `Du är AI-coach för ${m.name} i Sektionen, ett indie-band från Göteborg i Operation POST II — EP till juli 2026.

De har precis checkat in sin obligatoriska timme för veckan. Nu frågar du om de vill göra mer — ett sidequest.

Rolltyp: ${m.roleType}
Motivation: "${c.motivation || 'musik'}"
Aktuellt fokus: EP-produktion, individuella sociala kanaler, ideell → professionell

Skapa 3 sidequest-förslag. Lekfulla, kreativa, korta. Kan vara:
- Spela in en TikTok · Öva ett instrument utan mål i 30 min
- Skriva ett låtfragment · Lyssna aktivt på ett referensalbum
- Ringa någon i bandet och prata musik
- Något helt annat som passar deras rolltyp

XP ska vara lågt (25–50). Tonen inbjudande, aldrig pressande.

Svara EXAKT i JSON:
[{"title":"...","desc":"...","cat":"global|social|wisdom|money|health|tech","xp":25},{"title":"...","desc":"...","cat":"...","xp":35},{"title":"...","desc":"...","cat":"...","xp":50}]`;
}

// ── Exporterade funktioner ────────────────────────────────────────

/**
 * aiValidate(q, desc, event, rerender, showLU, showRW, showXPPop, rollReward)
 *
 * Validerar ett quest-svar via AI, sätter q.aiVerdict direkt på quest-objektet,
 * och tilldelar XP proportionellt mot AI-score.
 * Alla UI-callbacks vidarebefordras till awardXP så level-up och rewards fungerar.
 *
 * q           Quest-objekt
 * desc        Användarens text-svar
 * event       MouseEvent (för XP-pop-position, kan vara null)
 * rerender    () => void
 * showLU      (level) => void   — level-up overlay (valfri)
 * showRW      (reward) => void  — reward overlay (valfri)
 * showXPPop   (xp, event) => void (valfri)
 * rollReward  (xp) => reward | null (valfri)
 */
export async function aiValidate(q, desc, event, rerender, showLU, showRW, showXPPop, rollReward) {
  const m = MEMBERS[S.me];
  const c = S.chars[S.me];
  if (!m || !c) return;

  // Optimistisk UI: markera som "thinking"
  const questIdx = S.quests.findIndex(sq => sq.id === q.id);
  if (questIdx !== -1) S.quests[questIdx].aiThinking = true;
  rerender?.();

  try {
    const txt      = await callClaude(buildValidatePrompt(m, c, q, desc), 150);
    const score    = parseInt(txt.match(/SCORE:(\d+)/)?.[1]  || '50');
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
    rerender?.();

    if (verdict !== 'rejected' && xpEarned > 0) {
      setTimeout(() => awardXP(q, xpEarned, event, rerender, showLU, showRW, showXPPop, rollReward), 1200);
    }
  } catch {
    if (questIdx !== -1) {
      S.quests[questIdx].aiThinking = false;
      S.quests[questIdx].aiVerdict  = { text: 'AI ej tillgänglig — halvt XP tilldelat', cls: 'v-partial' };
    }
    rerender?.();
    setTimeout(() => awardXP(q, Math.round(q.xp * 0.5), event, rerender, showLU, showRW, showXPPop, rollReward), 800);
  }
}

/**
 * generatePersonalQuests(refreshMode, rerender)
 *
 * Genererar 4 personliga AI-quests baserade på rollkalibrering.
 * Lägger direkt till i S.quests och anropar rerender.
 * I refreshMode: tar bort gamla completade personal quests först.
 */
export async function generatePersonalQuests(refreshMode = false, rerender) {
  const m = MEMBERS[S.me];
  const c = S.chars[S.me];
  if (!m || !c) return;

  try {
    const txt    = await callClaude(buildQuestGenPrompt(m, c, refreshMode), 700);
    const parsed = parseJSON(txt);

    if (refreshMode) {
      // Ta bort gamla completade personal quests (men behåll ghost quests och aktiva)
      S.quests = S.quests.filter(q =>
        !(q.owner === S.me && q.personal && q.type !== 'ghost' && q.done)
      );
    }

    let nextId = Math.max(400, ...S.quests.map(q => q.id || 0)) + 1;
    parsed.forEach(q => {
      S.quests.push({
        id:        nextId++,
        owner:     S.me,
        title:     q.title,
        desc:      q.desc,
        cat:       q.cat,
        xp:        q.xp,
        stars:     '',
        region:    '🌐 Personal',
        recur:     'none',
        type:      q.type,
        done:      false,
        aiVerdict: null,
        personal:  true,
      });
    });
  } catch {
    // Fallback: minimal quest om AI misslyckas
    S.quests.push({
      id:        401,
      owner:     S.me,
      title:     `${MEMBERS[S.me]?.name}: en sak den här veckan`,
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
  rerender?.();
}

/**
 * refreshCoach()
 * Hämtar en personlig coaching-insikt och returnerar texten som sträng.
 * UIen (AICoach.jsx) ansvarar för loading-state och rendering.
 * Returnerar alltid en sträng — aldrig undefined.
 */
export async function refreshCoach() {
  const m = MEMBERS[S.me];
  const c = S.chars[S.me];
  if (!m || !c) return 'Laddar din profil...';

  try {
    return await callClaude(buildCoachPrompt(m, c), 150);
  } catch {
    return 'Håll ut. Det du bygger nu syns inte ännu — men det spelar roll.';
  }
}

/**
 * checkGhostQuest(rerender)
 * Kontrollerar om ghost quest ska triggas (7 dagars quest-inaktivitet).
 * Lägger till en ghost quest i S.quests om villkoren är uppfyllda.
 */
export async function checkGhostQuest(rerender) {
  const c = S.chars[S.me];
  const m = MEMBERS[S.me];
  if (!c || !m) return;

  const lastQuestDate = c.lastQuestDate || c.lastSeen || (Date.now() - 8 * 24 * 60 * 60 * 1000);
  const daysSince = (Date.now() - lastQuestDate) / (1000 * 60 * 60 * 24);

  if (daysSince < 7) return;
  if (S.quests.some(q => q.owner === S.me && q.type === 'ghost' && !q.done)) return;

  let ghostData;
  try {
    const txt = await callClaude(buildGhostPrompt(m, c, daysSince), 200);
    ghostData = parseJSON(txt);
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
    owner:     S.me,
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
  rerender?.();
}

/**
 * showSidequestNudge(weekKey)
 * Genererar 3 sidequest-förslag och returnerar dem som array.
 * WeeklyCheckout.jsx / SidequestNudge.jsx renderar listan.
 * weekKey används av komponenten för att markera veckan som "sidequested".
 * Returnerar alltid en array — aldrig undefined.
 */
export async function showSidequestNudge(weekKey) {
  const m = MEMBERS[S.me];
  const c = S.chars[S.me];

  const fallbacks = [
    { title: 'Spela utan mål',     desc: 'Ta upp instrumentet och spela vad som kommer. Ingen agenda.',       cat: 'health', xp: 25 },
    { title: 'Kreativt fragment',  desc: 'Skriv ett vers, ett riff eller en melodi. Bara ett fragment.',     cat: 'wisdom', xp: 35 },
    { title: 'Ring någon i bandet', desc: 'Prata musik med ett bandmedlem — inte planering, bara musik.',   cat: 'global', xp: 25 },
  ];

  if (!m || !c) return fallbacks;

  try {
    const txt    = await callClaude(buildSidequestPrompt(m, c), 400);
    const parsed = parseJSON(txt);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallbacks;
  } catch {
    return fallbacks;
  }
}
