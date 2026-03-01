const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

async function callAI(systemPrompt, userPrompt, apiKey) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

export async function refreshCoach(S, MEMBERS, callback) {
  const me = S.me;
  if (!me) return;
  const char = S.chars[me];
  const member = MEMBERS[me];
  const apiKey = localStorage.getItem('anthropic-key') || '';
  if (!apiKey) { callback('(Ingen API-nyckel inställd)'); return; }

  const system = `Du är en personlig coach för ${member?.name || me}, ${member?.role || 'teammedlem'} i musikprojektet Sektionen. Ge konkret, motiverande feedback på 1-2 meningar på svenska. Var specifik och inspirerande.`;
  const user = `Min nuvarande nivå är ${char?.level || 1}, jag har gjort ${char?.questsDone || 0} uppdrag, och min streak är ${char?.streak || 0}. Mina poäng: arbete ${char?.pts?.work || 0}, spotify ${char?.pts?.spotify || 0}, socialt ${char?.pts?.social || 0}. Ge mig en kort coaching-inblick.`;

  try {
    const text = await callAI(system, user, apiKey);
    callback(text.trim());
  } catch (e) {
    callback('(Kunde inte hämta coaching-insikt)');
  }
}

export async function generatePersonalQuests(S, MEMBERS, ROLE_TYPES, ROLE_TYPE_LABEL, HIDDEN_BY_TYPE, getRoleHidden, refreshMode, callbacks) {
  const { onStart, onProgress, onDone, onError } = callbacks || {};
  const me = S.me;
  if (!me) { onError?.('Ingen användare vald'); return; }
  const char = S.chars[me];
  const member = MEMBERS[me];
  const rt = char?.roleType || member?.roleType || 'amplifier';
  const roleInfo = ROLE_TYPES[rt];
  const apiKey = localStorage.getItem('anthropic-key') || '';
  if (!apiKey) { onError?.('Ingen API-nyckel inställd'); return; }

  onStart?.();

  const system = `Du är en speldesigner för gamification-systemet "Sektionen War Room". Skapa personliga uppdrag (quests) på svenska för en bandmedlem. Returnera ENBART ett JSON-array med 3 uppdrag. Varje uppdrag har: id (string), cat ("personal"), title (string, max 30 tecken), desc (string, max 120 tecken), xp (number 50-200), icon (emoji), recur ("weekly"), region ("all"/"social"/"tech"/"business").`;

  const user = `Skapa 3 personliga uppdrag för ${member?.name}, ${member?.role} (rolltyp: ${roleInfo?.label || rt}).
Motivation: ${char?.motivation || 'Ej angiven'}
Njuter av: ${char?.roleEnjoy || 'Ej angiven'}
Tyckt är jobbigt: ${char?.roleDrain || 'Ej angiven'}
Dolt värde: ${char?.hiddenValue || 'Ej angiven'}
Gap att fylla: ${char?.gap || 'Ej angiven'}
${refreshMode ? 'Det här är en uppdatering — skapa NYA uppdrag som är annorlunda från tidigare.' : ''}
Returnera ENBART JSON-array, inga förklaringar.`;

  try {
    onProgress?.('Genererar uppdrag...');
    const text = await callAI(system, user, apiKey);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Ogiltigt JSON-svar');
    const quests = JSON.parse(jsonMatch[0]);
    const personalQuests = quests.map((q, i) => ({
      ...q,
      id: `personal-${me}-${Date.now()}-${i}`,
      cat: 'personal',
      done: false,
      aiVerdict: null,
      personal: true,
    }));
    // Remove old personal quests for this user
    S.quests = S.quests.filter(q => !(q.personal && q.id?.includes(`personal-${me}`)));
    S.quests = [...S.quests, ...personalQuests];
    onDone?.(personalQuests);
  } catch (e) {
    onError?.(e.message || 'Fel vid generering av uppdrag');
  }
}

export async function checkGhostQuest(S, MEMBERS, callback) {
  const me = S.me;
  if (!me) return;
  const member = MEMBERS[me];
  const apiKey = localStorage.getItem('anthropic-key') || '';
  if (!apiKey) return;

  const system = `Du är mystisk spelberättare för Sektionen War Room. Skapa ett kortlivat "ghost quest" på svenska. Returnera ENBART JSON med: id, cat ("hidden"), title, desc, xp (150-300), icon, region ("all"), aiRequired (true), expires (milliseconds from now, 24h = 86400000).`;
  const user = `Skapa ett hemligt uppdrag för ${member?.name || me}, ${member?.role || 'bandmedlem'}. Var mystisk och intrigant.`;

  try {
    const text = await callAI(system, user, apiKey);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const quest = JSON.parse(jsonMatch[0]);
    callback({ ...quest, id: `ghost-${Date.now()}`, done: false, aiVerdict: null, ghost: true });
  } catch (e) {
    // Silent fail for ghost quests
  }
}

export async function showSidequestNudge(weekKey, S, MEMBERS, callback) {
  const me = S.me;
  if (!me) return;
  const member = MEMBERS[me];
  const apiKey = localStorage.getItem('anthropic-key') || '';
  if (!apiKey) return;

  const system = `Du är en uppmuntrande spelcoach för Sektionen. Skapa 2 korta sidouppdrag (sidequests) på svenska för veckan. Returnera ENBART JSON-array med 2 objekt: id, cat ("sidequest"), title (max 25 tecken), desc (max 80 tecken), xp (20-60), icon, recur ("weekly"), region ("all").`;
  const user = `Skapa sidouppdrag för ${member?.name || me} för vecka ${S.weekNum || 1}. Håll dem korta och uppnåbara.`;

  try {
    const text = await callAI(system, user, apiKey);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;
    const quests = JSON.parse(jsonMatch[0]);
    callback(quests.map((q, i) => ({
      ...q,
      id: `sidequest-${weekKey}-${i}`,
      done: false,
      aiVerdict: null,
    })));
  } catch (e) {
    // Silent fail
  }
}

export async function aiValidate(q, desc, S, MEMBERS, callback) {
  const me = S.me;
  if (!me) return;
  const member = MEMBERS[me];
  const apiKey = localStorage.getItem('anthropic-key') || '';
  if (!apiKey) { callback({ approved: false, message: 'Ingen API-nyckel inställd' }); return; }

  const system = `Du är en strikt men rättvis domare för Sektionen War Room. Bedöm om en beskrivning motiverar att ett uppdrag är slutfört. Svara ENBART med JSON: { "approved": boolean, "message": "kort förklaring på svenska (max 80 tecken)" }`;
  const user = `Uppdrag: "${q.title}" — ${q.desc}
Spelarens beskrivning: "${desc}"
${member?.name} (${member?.role}) försöker slutföra detta uppdrag. Är det godkänt?`;

  try {
    const text = await callAI(system, user, apiKey);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { callback({ approved: false, message: 'Ogiltigt svar från AI' }); return; }
    callback(JSON.parse(jsonMatch[0]));
  } catch (e) {
    callback({ approved: false, message: e.message || 'Fel vid validering' });
  }
}
