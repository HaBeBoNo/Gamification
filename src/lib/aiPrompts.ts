// ═══════════════════════════════════════════════════════════════
// aiPrompts.ts — Promptmallar och coach-identiteter för Sektionen
// Extraherat från useAI.ts för separation av logik och text.
// ═══════════════════════════════════════════════════════════════

import { S } from '../state/store';
import { ROLE_TYPES } from '../data/members';
import { isQuestDoneNow } from './questUtils';
import type { CharData, Quest } from '../types/game';
import type { Member } from '../data/members';

// ── Promptbyggare ──────────────────────────────────────────────────

export function buildValidatePrompt(m: Member, c: CharData, q: Quest, desc: string): string {
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

export function buildQuestGenPrompt(m: Member, c: CharData, refreshMode: boolean): string {
  const rtLabel = ROLE_TYPES[m.roleType]?.label || 'Amplifier';
  const rtDesc  = ROLE_TYPES[m.roleType]?.desc  || '';
  const completedQuests = S.quests
    .filter(q => q.owner === S.me && (q.completedAt || q.completionCount))
    .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));

  const recentReflections = completedQuests
    .filter(q => q.lastReflection)
    .slice(-5)
    .map(q => `"${q.title}": ${q.lastReflection}`)
    .join('\n');

  const recentCompleted = completedQuests
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
- Vad i rollen som kostar mer än det ger: "${c.roleDrain || 'ej angiven'}"
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

export function buildSidequestPrompt(m: Member, c: CharData): string {
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
