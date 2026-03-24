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
- Motivation: \