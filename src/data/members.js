// ═══════════════════════════════════════════════════════════════
// members.js — Sektionen Gamification
// Operation POST II · Mars 2026
// ═══════════════════════════════════════════════════════════════

// ── Member-struktur ──────────────────────────────────────────────
// name:      visningsnamn
// role:      officiell roll (från verksamhetsplan 2026)
// emoji:     avatar-ikon
// color:     bakgrundsfärg för kort (rgba)
// xpColor:   accentfärg för XP-bar och detaljer
// roleType:  'amplifier' | 'enabler' | 'builder'
//            — styr XP-viktning, quest-generation och coach-ton
//
// roleType-logik:
//   amplifier  Skapar räckvidd och energi utåt. Drivs av synlighet och
//              respons. Hannes, Nisse.
//   enabler    Möjliggör för andra. Osynligt arbete med hög systemvikt.
//              Martin, Johannes, Niklas.
//   builder    Bygger struktur och riktning. Tänker långsiktigt.
//              Ludvig, Simon, Carl.
// ────────────────────────────────────────────────────────────────

export const MEMBERS = {

  hannes: {
    name: 'Hannes',
    role: 'Creative Director',
    emoji: '🎨',
    color: 'rgba(200,100,50,0.15)',
    xpColor: '#e07840',
    roleType: 'amplifier',
    // Varumärkesidentitet, digital närvaro, strategisk planering.
    // Bandets meta-konto, content, biografi, tidsplaner.
    // Lyricist. Arbetar 21–01 när familjen sover.
    // Ansvarar ensam för strategi, brand, systemadmin.
  },

  ludvig: {
    name: 'Ludvig',
    role: 'Ordförande',
    emoji: '👑',
    color: 'rgba(64,192,80,0.12)',
    xpColor: '#40c060',
    roleType: 'builder',
    // Övergripande ledning, projektledning, strategi.
    // Bollplank, enabler, maskot — poäng för delaktighet i processer.
    // Startade merch-konceptet av ren vilja.
    // VIKTIGT: Använd alltid impact-språk. Aldrig organisatoriskt.
    // Tala om vad som sker TACK VARE honom, aldrig om rollen i sig.
  },

  martin: {
    name: 'Martin',
    role: 'Head of Production',
    emoji: '🎛️',
    color: 'rgba(64,128,224,0.12)',
    xpColor: '#4090e0',
    roleType: 'enabler',
    // Övergripande kvalitetsansvar. Koordinerar EP-inspelningar.
    // Inspelningstekniker, producent, saxofonist, senior adviser.
    // Tysk. Disciplinerad och rak. Levererar vid tydlig scope + deadline.
    // Inget eget socialt konto — levererar material till övriga.
    // Ansvarar för STEMS-beredning av hela katalogen.
  },

  nisse: {
    name: 'Nisse',
    role: 'PR & Outreach',
    emoji: '📡',
    color: 'rgba(160,80,224,0.12)',
    xpColor: '#a050e0',
    roleType: 'amplifier',
    // Mediekontakter, spellistor, press-pitch, community.
    // Japan X-konto som verktyg under Outreach.
    // Musiker: stämsång och bas.
    // Hög energi. Söker struktur, inte motivation.
  },

  simon: {
    name: 'Simon',
    role: 'Business Manager',
    emoji: '💼',
    color: 'rgba(224,80,64,0.12)',
    xpColor: '#e06050',
    roleType: 'builder',
    // Bokning, förhandling, externa samarbeten, sponsorer.
    // Mål: minst 5 spelningar 2026.
    // Relationsbyggande — nya kontakter ger XP även utan direkt effekt.
    // Stabil, snäll, pålitlig. Levererar när han förstår att det behövs.
  },

  johannes: {
    name: 'Johannes',
    role: 'Logistics & Merch',
    emoji: '🗂️',
    color: 'rgba(64,160,224,0.12)',
    xpColor: '#40a0e0',
    roleType: 'enabler',
    // Merch-drift, webshop, emblem-kollektion, vinyl, platsansvar.
    // Tar över merch-driften från Ludvig som startade konceptet.
    // Mål: webshop med vinyl, tändare, kläder och emblem-kollektion.
    // Lojal, uppriktig. Levererar vid tydlig deadline.
  },

  carl: {
    name: 'Carl',
    role: 'Grant Manager',
    emoji: '📋',
    color: 'rgba(200,160,64,0.12)',
    xpColor: '#c8a040',
    roleType: 'builder',
    // Söker kulturbidrag för att involvera externa kreatörer.
    // Bild, rörlig bild, dylik produktion — kreativ investering.
    // Mål: bli skicklig på att ansöka. Iteration är metoden.
    // ADD, introvert men genuint likeable. Befriend-förmågan.
    // Ge saklig, itererad, välgrundad feedback. Låg tröskel.
  },

  niklas: {
    name: 'Niklas',
    role: 'Tech & Facilities',
    emoji: '⚙️',
    color: 'rgba(64,192,128,0.12)',
    xpColor: '#40c080',
    roleType: 'enabler',
    // Replokal, studio, gemensam utrustning, inköp, reparationer.
    // Specialist med ADHD. Finansiellt trygg.
    // Levererar vid kristallklar spec och avgränsad scope.
    // Ge snabba, specificerade belöningar — omedelbar feedback viktig.
  },

};

// ── Hjälpfunktioner ──────────────────────────────────────────────

// Alla member-ids som array
export const MEMBER_IDS = Object.keys(MEMBERS);

// Hämta member-objekt med fallback
export function getMember(id) {
  return MEMBERS[id] || null;
}

// Rolltyp-metadata för UI och logik
export const ROLE_TYPES = {
  amplifier: {
    label: 'Amplifier',
    color: 'rgba(200,100,50,0.2)',
    border: 'rgba(200,100,50,0.4)',
    desc: 'Skapar räckvidd och energi utåt',
  },
  enabler: {
    label: 'Enabler',
    color: 'rgba(64,128,224,0.2)',
    border: 'rgba(64,128,224,0.4)',
    desc: 'Möjliggör för andra — osynligt arbete med hög systemvikt',
  },
  builder: {
    label: 'Builder',
    color: 'rgba(64,192,80,0.2)',
    border: 'rgba(64,192,80,0.4)',
    desc: 'Bygger struktur och riktning på lång sikt',
  },
};
