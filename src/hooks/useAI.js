// ═══════════════════════════════════════════════════════════════
// useAI.js — Anthropic API-anrop för Sektionen Gamification
// Mönster: direkt mutation av S + save() → notify() via Zustand
// Exporterar: aiValidate, generatePersonalQuests,
//             showSidequestNudge, refreshCoach, checkGhostQuest
// ═══════════════════════════════════════════════════════════════

import { S, save, notify } from '../state/store';
import { MEMBERS, ROLE_TYPES } from '../data/members';
import { awardXP } from './useXP';

const API_URL = '/api/claude';
const MODEL   = 'claude-sonnet-4-20250514';

// ── Coach-identiteter ──────────────────────────────────────────────

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
  hannes:   'Brand Manager. Visionär. Välkommen in.',
  martin:   'Head of Production. Ljudet är ditt. Välkommen in.',
  ludvig:   'Ordförande. Kittet som håller ihop. Välkommen in.',
  johannes: 'Logistik och scen. Grunden är lagd. Välkommen in.',
  simon:    'Business Manager. Kontakterna väntar. Välkommen in.',
  nisse:    'Outreach. Världen är större än Sverige. Välkommen in.',
  niklas:   'Tech och faciliteter. Systemet är ditt. Välkommen in.',
  carl:     'Medel och bidrag. Pengarna finns där ute. Välkommen in.',
};

const COACH_CONTEXT = {
  hannes:   'Hannes har gjort enormt mycket operativt — mix, master, distribution, app, föreningskonto, releasefest. Risken är att han fortsätter i samma modus istället för att växla till strategiskt tänkande. Utmana det varsamt. Han söker kreativ vision och helhetsgrepp tillsammans med Ludvig.',
  martin:   'Martin har levererat på varje front — mix, master, saxofon, livemix, London-kontakter om STEMS. Han navigerar sin roll framåt. Saxofonen är en känslig punkt — han når inte samma nivå som resten av bandet ännu. Koppla alltid framsteg till bandet och de konkreta personerna i det. Konfrontera aldrig saxofon-osäkerheten direkt — möt den med nyfikenhet.',
  ludvig:   'Ludvig håller ihop bandet bakifrån — merch, styrelsemöten, individuella samtal som bollplank. Han saknar tydlig egen identitet i bandet. Det finns motivation och potential men ingen klar riktning. Hjälp honom hitta sin riktning utan att definiera den åt honom. Öppna frågor, aldrig direktiv.',
  johannes: 'Johannes har steppat upp kraftigt — transport, TikTok med kontinuerliga live-sessions med professionellt ljud och bild. Han blomstrar med mandat och tydliga ramar. Han är också en utmärkt sångare med potential för stämsång — men det är hans musikeridentitet, inte hans primära roll. Låt musikerrollen komma fram naturligt som sidequest när han själv öppnar den dörren.',
  simon:    'Simon drivs av kommando och konkreta uppdrag. Han har ordnat matavtal och affischering till releasefesten. Han behöver proaktivt nätverkande med lokala, regionala, nationella och internationella aktörer. Var aldrig vag — alltid specifikt och handlingsorienterat. Om han saknar uppdrag är det systemets ansvar att ge honom ett.',
  nisse:    'Nisse har submitttat till etablerade spellistor och intensifierar marknadsföring. Han behöver bli trygg i rollen som kontaktperson för etablerad media. Konkretisera hans impact — visa vad som rör sig, inte bara vad som ska hända. Hans osäkerhet kring mediekontakter är en möjlighet.',
  niklas:   'Niklas har inte bidragit konkret den senaste perioden. Konfrontera det inte direkt — väck nyfikenhet och koppla hans tekniska intresse till något konkret i bandet. Små steg, ingen press. Målet är att hitta glädjen i att göra nytta.',
  carl:     'Carl har påbörjat kontakt med Studiefrämjandet. Han behöver struktur och system, inte motivation. Hjälp honom bygga ett hållbart arbetssätt för bidragsansökningar. Alltid en fråga i slutet av varje coaching-session. Fokus på stiftelser, fonder, stipendier och kommunbidrag — var öppen för att det kan vara många olika typer av organisationer.',
};

// ── Intern hjälp ─────────────────────────────────────────────────

async function callClaude(prompt, maxTokens = 400) {
  const res = await fetch(API_URL, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

  const recentReflections = S.quests
    .filter(q => q.owner === S.me && q.done && q.lastReflection)
    .slice(-5)
    .map(q => `"${q.title}": ${q.lastReflection}`)
    .join('\n');

  const recentCompleted = S.quests
    .filter(q => q.owner === S.me && q.done)
    .slice(-5)
    .map(q => q.title)
    .join(', ');

  const prevGenerated = (c.generatedHistory || []).slice(-10).join(', ');

  return `Du är en strategisk AI-coach för Sektionen, ett 8-personersband från Göteborg på väg mot professionell verksamhet.
${refreshMode ? 'OBS: REFRESH — personen har completat sina förra quests. Skapa nya som bygger vidare, inte samma som sist. Kontexten: Operation POST II, truminspelning juli 2026, ideell → professionell.' : ''}

Styrelsemedlem: ${m.name} (${m.role})

ROLLKALIBRERING:
- Varför de spelar musik: "${c.motivation || 'ej angiven'}"
- Vad de faktiskt gör med glädje i sin roll: "${c.roleEnjoy || 'ej angiven'}"
- Vad i rollen kostar mer än det ger: "${c.roleDrain || 'ej angiven'}"
- Dold insats som ingen förväntar sig: "${c.hiddenValue || 'ej angiven'}"
- Gap de ser att ingen fyller: "${c.gap || 'ej angiven'}"
${c.roleReaction ? `\nDe reagerade på sin rollbeskrivning med: "${c.roleReaction}"
${c.roleReaction === 'no' ? 'VIKTIGT: Deras roll är annorlunda än systemet antog. Var försiktig med antaganden.' : ''}
${c.roleReaction === 'partly' ? 'Deras roll är delvis som beskrivet — håll quests öppna och utforskande.' : ''}` : ''}

Sektionens läge:
Album II ute 1 mars 2026. Releasekonsert genomförd 7 mars Ölslanda Södergård.
Vi är nu i post-release fasen — fokus skiftar från lansering till momentum-byggande.

Nästa produktionsmilstolpe: truminspelning klar juli 2026.
Vägen dit: låtskrivande, arrangemang och övning behöver mogna organiskt.
Materialet till EP:n är odefinierat — det växer fram på rep, i stunden, av vad som lever.
Ingen låt är låst. Inget innehåll är bestämt än.

VIKTIGT för quest-generering:
- Kreativt arbete (övning, låtskrivande, repande) ska ALDRIG vara obligatoriska quests
- Kreativa quests är alltid type:"creative" — process, inte produkt
- Peka mot förutsättningar och närvaro, aldrig mot specifika leveranser
- "Repa utan agenda" är en bättre quest än "skriv en låt till EP:n"

Rolltyp: ${rtLabel} — ${rtDesc}
VIKTIGT: Anpassa strikt till rolltypen.
- amplifier: sociala medier, storytelling, synlighet OK
- enabler: INGA sociala medier-quests — infrastruktur, teknik, produktion
- builder: milstolpar och strategiska beslut — INTE dagliga aktiviteter

Vad de faktiskt gjort senast:
${recentCompleted || 'inga completade quests än'}

Deras egna ord:
${recentReflections || 'inga reflektioner än'}

VIKTIGT: Generera INTE quests som liknar det de redan gjort.
Bygg vidare — nästa naturliga steg, inte samma steg igen.

Tidigare genererade quests (upprepa INTE dessa):
${prevGenerated || 'inga'}

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

function buildCoachPrompt(memberKey) {
  const c = S.chars[memberKey] || {};
  const coachName = c.coachName || DEFAULT_COACH_NAMES[memberKey] || 'Coach';

  const COACH_PERSONALITIES = {
    hannes: `Du är ${coachName} — Hannes personliga coach. Hannes drivs av dopamin och kreativ energi. Han ser mönster och möjligheter innan andra. Din roll: skärp hans fokus utan att döda energin. Kort, precist, utmanande. Aldrig föreläsande.`,
    martin: `Du är ${coachName} — Martins personliga coach. Martin drivs av vänskap och lojalitet mot de han spelar med. Han rör sig när relationen är stark. Din roll: koppla alltid insatser till bandet och de konkreta personerna i det. Aldrig abstrakt. Aldrig ensam.`,
    niklas: `Du är ${coachName} — Niklas personliga coach. Niklas tänker i system och narrativ — han är Guild Architect. Han vill förstå hur delarna hänger ihop. Din roll: visa honom helheten och hans plats i den. Tekniskt konkret, aldrig vagt.`,
    carl:   `Du är ${coachName} — Carls personliga coach. Carl tolkar och analyserar — han ser vad andra missar. Han behöver öppna frågor, inte direktiv. Din roll: ställ en fråga, lyssna på svaret, bygg vidare. Aldrig mer än tre meningar åt gången.`,
    nisse:  `Du är ${coachName} — Nisses personliga coach. Nisse drivs av bekräftelse och synlighet — han behöver se att det han gör faktiskt spelar roll. Din roll: konkretisera hans impact utan att smickra. Visa vad som rör sig, inte vad som är bra.`,
    simon:  `Du är ${coachName} — Simons personliga coach. Simon drivs av lojalitet och långsiktig tillit. Han bygger relationer som håller. Din roll: hjälp honom se när lojaliteten är en styrka och när den håller honom kvar för länge. Direkt, respektfullt.`,
    johannes: `Du är ${coachName} — Johannes personliga coach. Johannes äger sitt territorium — logistik, merch, konsertuppbyggnad. Han behöver mandat och tydlighet. Din roll: bekräfta hans ägarskap och utmana honom att expandera det. Konkret, aldrig diffust.`,
    ludvig: `Du är ${coachName} — Ludvigs personliga coach. Ludvig drivs av spontanitet och möjligheter. Han ser öppningar och vill agera. Din roll: hjälp honom kanalisera energin utan att bromsa den. Kort, snabbt, handlingsorienterat.`,
  };

  const personality = COACH_PERSONALITIES[memberKey] || `Du är ${coachName}, personlig coach för ${memberKey} i Sektionen.`;

  const contextNote = COACH_CONTEXT[memberKey] || '';
  const contextNoteSection = contextNote ? `
Bakgrundskontext om ${memberKey} (känn till detta, referera aldrig till det direkt):
${contextNote}
` : '';

  const onboardingContext = `
Onboarding-svar från ${memberKey}:
- Ett ögonblick de inte skulle vilja vara utan: "${c.motivation || 'ej angiven'}"
- Vad i rollen som känns mest naturligt: "${c.roleEnjoy || 'ej angiven'}"
- Vad i Sektionen som ger dem energi: "${c.roleDrain || 'ej angiven'}"
- Vad de vill bli bättre på: "${c.hiddenValue || 'ej angiven'}"
- Deras unika avtryck i Sektionen: "${c.gap || 'ej angiven'}"`;

  const coachRules = `
Regler som alltid gäller:
- Öppna aldrig med beröm, instämmande eller "bra fråga"
- Inga klichéer. Inga motivationsfraser. Konkret språk alltid
- Kort och precist — håll dig under 4 meningar om inget annat krävs
- Läs mellan raderna — vad säger personen egentligen, inte bara vad de skriver
- Visa konkret gap mellan nuläge och nästa nivå när det är relevant
- Var ärlig när något inte fungerar — du är inte en cheerleader
- Om meddelandet är otvetydigt tvetydigt: ställ en enda precis fråga, aldrig fler
- Svara alltid på svenska`;

  /* ── responseProfile context ── */
  const profile = c.responseProfile;
  const profileContext = profile ? `
Kommunikationsprofil:
- Register: ${profile.register}
- Ton: ${profile.tone}
- Komplexitet: ${profile.languageComplexity}
- Metaforisk: ${profile.metaphorical}
- Pronomen: ${profile.pronounDominance}
- Dominerande tema: ${profile.dominantTheme}
- Frånvarande dimensioner: ${(profile.silences||[]).join(', ')||'–'}
- Engagemang: ${profile.engagement}

Kalibrera ton och djup efter profilen. Spegla personens språk utan att imitera.
Om metaphorical är true — använd bilder naturligt.
Om languageComplexity är simple — håll dig konkret och kort.
Om pronounDominance är vi — koppla alltid till bandet.` : '';

  /* ── temporalBehavior context ── */
  const temporal = c.temporalBehavior;
  const temporalContext = temporal ? `
Temporalt mönster: ${temporal.pattern}
Urgency: ${temporal.currentUrgency}
Avviker från mönster: ${temporal.anomaly}

Om urgency > 0.7: stödjande och avdramatiserande, aldrig pådrivande.
Om urgency 0.3–0.7: fokuserad och konkret, inga sidospår.
Om urgency < 0.3: utforskande och öppen.
Om anomaly är true: något har förändrats — möt med nyfikenhet.` : '';

  /* ── quest insights context ── */
  const insights = (S.quests || [])
    .filter(q => q.owner === memberKey && q.insight)
    .slice(-5)
    .map(q => `"${q.title}": ${q.insight}`)
    .join('\n');
  const insightContext = insights ? `
Senaste reflektioner:
${insights}
Använd som ingångspunkter — aldrig mekaniskt.` : '';

  /* ── Borttagningshistorik ── */
  const deletedQuests = (S.chars[memberKey]?.deletedQuests || []).slice(-5);
  const deletionContext = deletedQuests.length > 0 ? `
Borttagna uppdrag (member-signaler om kalibrering):
${deletedQuests.map(d => `- "${d.title}" (${d.cat}): ${
  d.reason === 'irrelevant' ? 'inte relevant för rollen' :
  d.reason === 'done'       ? 'redan gjort' :
  'fel timing'
}`).join('\n')}

Undvik att generera liknande uppdrag inom samma kategori om reason är 'irrelevant'.
Om reason är 'timing' — föreslå samma typ av uppdrag igen om 2–3 veckor.` : '';

  /* ── Hyperfokus-signal ── */
  const activeCount = (S.quests || []).filter(
    q => q.owner === memberKey && !q.done
  ).length;

  const focusContext = activeCount <= 3 ? `
${memberKey} har just ${activeCount} aktiva uppdrag. Det är ett medvetet val — hyperfokus.
Uppmuntra det. Generera inte fler uppdrag om inte member explicit ber om det.` : '';

  return `${personality}\n${contextNoteSection}\n${coachRules}\n${onboardingContext}\n${profileContext}\n${temporalContext}\n${insightContext}\n${deletionContext}\n${focusContext}`;
}

function buildGhostPrompt(m, c, daysSince) {
  return `Du är AI-coach för ${m.name} i Sektionen, ett 8-personersband från Göteborg på väg från ideell till professionell verksamhet. Operation POST II pågår — truminspelning juli 2026.

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
  return `Du är AI-coach för ${m.name} i Sektionen, ett indie-band från Göteborg i Operation POST II — truminspelning juli 2026.

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
 * aiValidate(q, desc, event, showLU, showRW, showXPPop, rollReward)
 *
 * Validerar ett quest-svar via AI, sätter q.aiVerdict direkt på quest-objektet,
 * och tilldelar XP proportionellt mot AI-score.
 * Alla UI-callbacks vidarebefordras till awardXP så level-up och rewards fungerar.
 *
 * q           Quest-objekt
 * desc        Användarens text-svar
 * event       MouseEvent (för XP-pop-position, kan vara null)
 * showLU      (level) => void   — level-up overlay (valfri)
 * showRW      (reward) => void  — reward overlay (valfri)
 * showXPPop   (xp, event) => void (valfri)
 * rollReward  (xp) => reward | null (valfri)
 */
export async function aiValidate(q, desc, event, showLU, showRW, showXPPop, rollReward) {
  const m = MEMBERS[S.me];
  const c = S.chars[S.me];
  if (!m || !c) return;

  // Optimistisk UI: markera som "thinking"
  const questIdx = S.quests.findIndex(sq => sq.id === q.id);
  if (questIdx !== -1) S.quests[questIdx].aiThinking = true;
  notify();

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
 *
 * Genererar 4 personliga AI-quests baserade på rollkalibrering.
 * Lägger direkt till i S.quests och sparar (save() triggar notify()).
 * I refreshMode: tar bort gamla completade personal quests först.
 */
export async function generatePersonalQuests(refreshMode = false) {
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

    // Store generated titles so next generation doesn't repeat
    const newTitles = parsed.map(q => q.title);
    S.chars[S.me].generatedHistory = [
      ...(S.chars[S.me].generatedHistory || []),
      ...newTitles
    ].slice(-20);
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
}

/**
 * refreshCoach()
 * Hämtar en personlig coaching-insikt och returnerar texten som sträng.
 * UIen (AICoach.jsx) ansvarar för loading-state och rendering.
 * Returnerar alltid en sträng — aldrig undefined.
 */
export async function refreshCoach() {
  if (!S.me || !S.chars[S.me]) return 'Laddar din profil...';

  try {
    return await callClaude(buildCoachPrompt(S.me), 200);
  } catch {
    return 'Håll ut. Det du bygger nu syns inte ännu — men det spelar roll.';
  }
}

/**
 * checkGhostQuest()
 * Kontrollerar om ghost quest ska triggas (7 dagars quest-inaktivitet).
 * Lägger till en ghost quest i S.quests om villkoren är uppfyllda.
 */
export async function checkGhostQuest() {
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
