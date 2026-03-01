export const BASE_QUESTS = [
  // ── DAILY ─────────────────────────────────────────────────────────────────
  { id:'d1', cat:'daily', title:'Morgon-commit', desc:'Checka in före kl 09:00 — närvaro är disciplin.', xp:30, icon:'🌅', recur:'daily', region:'all' },
  { id:'d2', cat:'daily', title:'Kvälls-reflektion', desc:'Skriv tre meningar om vad du åstadkom idag.', xp:25, icon:'🌙', recur:'daily', region:'all' },
  { id:'d3', cat:'daily', title:'Fokus-block', desc:'Arbeta 90 min utan avbrott på huvuduppgiften.', xp:40, icon:'⏱️', recur:'daily', region:'all' },
  { id:'d4', cat:'daily', title:'En sak klar', desc:'Slutför minst en konkret uppgift från din lista.', xp:35, icon:'✅', recur:'daily', region:'all' },

  // ── SOCIAL ────────────────────────────────────────────────────────────────
  { id:'s1', cat:'social', title:'Dela ett inlägg', desc:'Publicera ett inlägg om Sektionen på valfri plattform.', xp:50, icon:'📣', recur:'weekly', region:'social' },
  { id:'s2', cat:'social', title:'Engagera följare', desc:'Svara på minst 5 kommentarer eller DM:s.', xp:40, icon:'💬', recur:'weekly', region:'social' },
  { id:'s3', cat:'social', title:'Story-update', desc:'Posta en story om Sektionens aktivitet.', xp:30, icon:'📸', recur:'daily', region:'social' },
  { id:'s4', cat:'social', title:'Kollaborera', desc:'Tag med en extern partner eller vän i ett inlägg.', xp:60, icon:'🤝', recur:'weekly', region:'social' },

  // ── STRATEGIC ─────────────────────────────────────────────────────────────
  { id:'st1', cat:'strategic', title:'Strategi-session', desc:'Genomför ett 1-timmes strategimöte med tydlig agenda och actionpunkter.', xp:80, icon:'🗺️', recur:'weekly', region:'all', aiRequired:true },
  { id:'st2', cat:'strategic', title:'Partnerskap-pitch', desc:'Pitcha Sektionen för en potentiell partner eller sponsor.', xp:100, icon:'🎯', recur:'weekly', region:'business', aiRequired:true },
  { id:'st3', cat:'strategic', title:'Revenue-analys', desc:'Analysera senaste månadens intäkter och identifiera tre förbättringsområden.', xp:90, icon:'📊', recur:'weekly', region:'business', aiRequired:true },
  { id:'st4', cat:'strategic', title:'Roadmap-uppdatering', desc:'Uppdatera projektets roadmap med nästa 4 veckors milestones.', xp:70, icon:'🛤️', recur:'weekly', region:'all', aiRequired:true },

  // ── WISDOM ────────────────────────────────────────────────────────────────
  { id:'w1', cat:'wisdom', title:'Läs 30 min', desc:'Läs en bok, artikel eller rapport relaterad till din roll.', xp:35, icon:'📚', recur:'daily', region:'all' },
  { id:'w2', cat:'wisdom', title:'Lyssna på podcast', desc:'Konsumera ett avsnitt inom musik, business eller kreativitet.', xp:25, icon:'🎧', recur:'daily', region:'all' },
  { id:'w3', cat:'wisdom', title:'Ny färdighet', desc:'Lär dig något nytt — tutorial, kurs eller workshop.', xp:60, icon:'🧠', recur:'weekly', region:'all' },

  // ── HEALTH ────────────────────────────────────────────────────────────────
  { id:'h1', cat:'health', title:'Träning 45 min', desc:'Genomför ett träningspass på minst 45 minuter.', xp:50, icon:'💪', recur:'daily', region:'all' },
  { id:'h2', cat:'health', title:'8h sömn', desc:'Logga 8 timmars sömn natten innan.', xp:30, icon:'😴', recur:'daily', region:'all' },
  { id:'h3', cat:'health', title:'Promenad utomhus', desc:'Ta en 20-minuters promenad utomhus.', xp:20, icon:'🚶', recur:'daily', region:'all' },

  // ── TECH ──────────────────────────────────────────────────────────────────
  { id:'t1', cat:'tech', title:'Code commit', desc:'Pusha minst ett meningsfullt kodkommit.', xp:40, icon:'💻', recur:'daily', region:'tech' },
  { id:'t2', cat:'tech', title:'Bug-fix', desc:'Identifiera och åtgärda ett tekniskt problem.', xp:55, icon:'🐛', recur:'weekly', region:'tech' },
  { id:'t3', cat:'tech', title:'Infrastruktur-förbättring', desc:'Implementera en förbättring av era digitala verktyg eller processer.', xp:70, icon:'🔧', recur:'weekly', region:'tech' },

  // ── MONEY ─────────────────────────────────────────────────────────────────
  { id:'m1', cat:'money', title:'Budget-review', desc:'Gå igenom veckans utgifter mot budget.', xp:45, icon:'💰', recur:'weekly', region:'business' },
  { id:'m2', cat:'money', title:'Intäktsmöjlighet', desc:'Identifiera och dokumentera en ny intäktsmöjlighet.', xp:65, icon:'📈', recur:'weekly', region:'business' },
  { id:'m3', cat:'money', title:'Kostnadsoptimering', desc:'Hitta ett område där kostnader kan sänkas utan att kvalitet påverkas.', xp:55, icon:'🔍', recur:'weekly', region:'business' },
];

export const HIDDEN_BANK = [
  { id:'hb1', cat:'hidden', title:'Hemlighet avslöjad', desc:'Du hittade ett dolt uppdrag. Slutför det utan att berätta för någon.', xp:120, icon:'🔮', region:'all' },
  { id:'hb2', cat:'hidden', title:'Nattlig operation', desc:'Utför uppdraget mellan 22:00 och 06:00.', xp:150, icon:'🌑', region:'all' },
  { id:'hb3', cat:'hidden', title:'Tyst hjälte', desc:'Gör något som hjälper teamet men berätta inte vad du gjort.', xp:100, icon:'🦸', region:'all' },
  { id:'hb4', cat:'hidden', title:'Pilgrimsresa', desc:'Besök en plats som inspirerar dig och dokumentera det med ett foto.', xp:90, icon:'🗺️', region:'all' },
  { id:'hb5', cat:'hidden', title:'Mästarens utmaning', desc:'Gör något du aldrig gjort förut inom din roll.', xp:200, icon:'⚔️', region:'all', aiRequired:true },
  { id:'hb6', cat:'hidden', title:'Kollektiv kraft', desc:'Organisera en oplanerad team-aktivitet inom 24 timmar.', xp:130, icon:'🔥', region:'all' },
];

export const HIDDEN_BY_TYPE = {
  amplifier: [
    { id:'ha1', cat:'hidden', title:'Viral moment', desc:'Skapa ett innehåll som når 10x din normala räckvidd.', xp:180, icon:'📡', region:'social', aiRequired:true },
    { id:'ha2', cat:'hidden', title:'Influencer-kontakt', desc:'Ta kontakt med en influencer som delar Sektionens värderingar.', xp:140, icon:'⭐', region:'social' },
  ],
  enabler: [
    { id:'he1', cat:'hidden', title:'System-arkitekt', desc:'Designa och implementera ett system som sparar teamet 5+ timmar/vecka.', xp:200, icon:'⚙️', region:'tech', aiRequired:true },
    { id:'he2', cat:'hidden', title:'Silent guardian', desc:'Fixa ett problem ingen annan visste om.', xp:160, icon:'🛡️', region:'tech' },
  ],
  builder: [
    { id:'hbu1', cat:'hidden', title:'Foundation layer', desc:'Lägg grunden för något som kommer att användas av teamet i minst 6 månader.', xp:190, icon:'🏗️', region:'all', aiRequired:true },
    { id:'hbu2', cat:'hidden', title:'Blueprint master', desc:'Skapa ett komplett dokument eller ramverk för en kritisk process.', xp:150, icon:'📐', region:'all' },
  ],
};

export function getRoleHidden(roleType) {
  return [...(HIDDEN_BY_TYPE[roleType] || []), ...HIDDEN_BANK];
}
