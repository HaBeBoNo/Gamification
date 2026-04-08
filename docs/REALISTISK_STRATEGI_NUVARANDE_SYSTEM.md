# Sektionen HQ — Realistisk Strategi Med Nuvarande System

## Syfte

Det här dokumentet beskriver den mest realistiska vägen framåt med:

- nuvarande produktidé
- nuvarande tekniska grund
- nuvarande tjänster och integrationer
- inga nya externa kostnader som krav

Tidsåtgång spelar mindre roll än disciplin. Strategin får gärna ta två år, men den ska fortfarande vara möjlig att genomföra utan att produkten byter natur eller att nya kostnadslager krävs.

## Premiss

Sektionen HQ ska inte försöka bli en allmän samarbetsplattform. Med nuvarande system är den bästa realistiska strategin att bli:

`den mest beroendeframkallande operativa vardagsytan för ett band`

Det betyder att framgång inte mäts i antal features utan i fyra effekter:

- medlemmar öppnar appen oftare utan påtryckning
- medlemmar vet snabbare vad de ska göra nu
- bandets verkliga aktivitet känns tydligare och mer levande
- interaktion mellan medlemmar sker oftare genom appen än utanför den

För att strategin ska vara styrbar måste dessa effekter översättas till enkla operativa mått.
Det betyder inte ett tungt KPI-system, men det betyder att varje etapp måste ha minst:

- en ledande indikator: något som visar tidigt att användarbeteendet rör sig åt rätt håll
- en eftersläpande indikator: något som visar att beteendet håller över tid

## Strategisk Kärna

Med nuvarande arkitektur bör appens kärna vara fem rum och fem signaltyper.

### Rum

- `Hem`: läget just nu
- `Quests`: vad du ska göra nu
- `Aktivitet`: vad bandet gör och svarar på
- `Band Hub`: kalender, filer, verklig samordning
- `Coach`: tolkning, prioritering, reflektion

### Signaltyper

- `riktning`: coachen pekar ut nästa steg
- `arbete`: ett quest eller en verklig handling blir gjord
- `social respons`: någon reagerar, svarar eller väntar på dig
- `samordning`: rep, RSVP, check-in, delade filer
- `reflektion`: systemet hjälper medlemmen förstå vad som hände

Det realistiska målet är inte att jämna ut alla rum. Det är att låta dem förstärka samma loop:

`coach -> quest -> verklig handling -> social respons -> nästa steg`

### Coachens rytm

Coachen får inte upplevas som en ständig textgenerator.
Med nuvarande system bör coachen följa en enkel grundrytm:

- coachen initierar riktning högst `en gång per dag` i Hem eller Quests
- coachen reagerar på slutförd handling eller tydlig reflektion `snabbt nog att kännas kopplad`, helst inom samma session
- coachen ska i första hand följa upp efter handling, inte konkurrera med ett redan aktivt arbetsflöde
- om medlemmen redan är mitt i ett tydligt flöde ska coachen hålla sig i bakgrunden och förstärka, inte avbryta

Det här är inte en slutgiltig AI-policy.
Det är en operativ startregel som ska hålla coachen sammanhängande tills en mer formaliserad coachdomän finns.

### Re-engagement vid låg aktivitet

Den här loopen får inte bara fungera när bandet redan är aktivt.

Systemet måste därför ha en tydlig hållning för låg aktivitet:

- efter `3 dagar` av låg social aktivitet ska appen fortfarande kunna ge en meningsfull återkomstpunkt via Hem, Coach eller Band Hub
- efter `7 dagar` av låg aktivitet ska systemet tydligt kunna sammanfatta vad som väntar, vad som saknas och vad som är enklast att återstarta
- efter `14 dagar` av låg aktivitet ska appen fortfarande kännas som en väg tillbaka in i bandets arbete, inte som ett tomt rum

Det här är inte i första hand en fråga om fler push-notiser. Det är en fråga om att alltid kunna presentera:

- vad som fortfarande är relevant
- vad som är minsta meningsfulla nästa steg
- vilka signaler från bandet som fortfarande betyder något

## Vad Nuvarande System Är Bra Nog För

Det nuvarande systemet är starkt nog för:

- ett internt band med hög tillit
- mobil-first vardagsanvändning
- lokal-first progression med serverägd socialitet
- låg-latensupplevelse för individuella handlingar
- strukturerade sociala signaler runt feed, notiser, presence och kollaborativa uppdrag

Det är inte starkt nog för:

- tung fler-enhetslogik i stor skala
- komplex transaktionsdomän mellan många användare
- bred B2C-lansering utan ytterligare konsolidering
- hög supportvolym eller kunddrift

## Huvudstrategi

Den realistiska vägen framåt är `konsoliderad hybrid`.

Det betyder:

- personlig progression får fortsätta vara lokal-first
- delad social sanning fortsätter flytta mot serverägda tabeller
- kalender, collab och feed behandlas som de viktigaste sociala ytorna
- UI/UX ska öka sammanhanget mellan rum, inte bredda appen med fler separata system

### Gränsdragningsregel: lokal vs server

Följande regel ska användas varje gång ett nytt dataobjekt eller flöde tillkommer:

- data som bara påverkar ägarens upplevelse är `lokal-first`
- data som minst en annan medlem behöver se för att kunna reagera eller agera är `server-first`
- data som behöver vara båda måste ha en dokumenterad konfliktlösningsregel i [ARCHITECTURE.md](/Users/t-nab/Documents/Gamification/docs/ARCHITECTURE.md) innan implementation

Praktiskt betyder det:

- personlig progression, lokal coachcache och personliga arbetsytor kan fortsätta vara lokala först
- notiser, social feed, presence, collab-status och kalenderrelaterade gruppsignaler ska behandlas som serverägd sanning

### Konfliktlösningsregel

När lokal progression och serverägd socialitet överlappar ska följande gälla:

- den personliga sanningen avgör vad medlemmen har gjort
- den delade sanningen avgör vad andra kan se och svara på
- om de hamnar i otakt är delad social signal aldrig ensam bevisning för personlig progression
- om ett flöde kräver att båda nivåerna stämmer måste det finnas en uttrycklig write-order och recovery-plan dokumenterad innan flödet betraktas som klart

Det här är inte en kompromiss av bekvämlighet. Det är den mest rationella strategin för nuvarande produktfas.

## Prioriteringsordning

### 1. Göra kärnloopen mer konsekvent

Det viktigaste är inte fler funktioner utan att samma upplevelselogik känns överallt:

- Hem visar riktning och social puls
- Quests är tydligaste operativa ytan
- Aktivitet är den primära platsen för social återkoppling
- Band Hub är den verkliga koordinationsytan
- Coach knyter ihop före, under och efter handling

Frågan vid varje ändring ska vara:

`gör detta nästa steg tydligare, social respons starkare eller verklig samordning enklare?`

### 2. Höja digniteten i sociala signaler

Nuvarande system har redan strukturerade notiser, reactions, witnesses, collab-signaler och presence. Den stora vinsten ligger i:

- bättre viktning
- mindre brus
- snabbare återkoppling på verkliga handlingar
- bättre riktning till rätt yta
- säkrare koppling mellan push, notis och destination

Det betyder att “interaktivitet” i första hand är ett signalproblem, inte ett funktionsproblem.

Det betyder också att timing är en del av kvaliteten.
En social signal som kommer för sent är inte bara svagare — den ändrar hela upplevelsen av om appen känns levande eller inte.

### 3. Göra Band Hub till verklig vardagsgenväg

Band Hub har potential att vara den starkaste återkomstmotorn efter Quests, eftersom den kopplar appen till:

- rep
- närvaro
- material
- senaste inspelning
- inköpslistor och praktiskt bandarbete

Med nuvarande system bör Band Hub vinna på tillgänglighet och organisering, inte på att bli en full Google Drive-klon.

### 4. Göra Profil begriplig, inte datarik

Profilen ska inte samla allt. Den ska skapa mening av:

- identitet
- rytm
- progression
- coachens läsning

Om Profil inte hjälper medlemmen förstå sig själv bättre än Topbar, Leaderboard och historik redan gör, ska den förenklas.

### 5. Dokumentera och disciplinera arkitekturen löpande

Med nuvarande hybridmodell är dokumentation inte kosmetik. Det är underhållsbarhet.

Det som måste hållas levande:

- [ARCHITECTURE.md](/Users/t-nab/Documents/Gamification/docs/ARCHITECTURE.md)
- [DEBUGGING_RUNBOOK.md](/Users/t-nab/Documents/Gamification/docs/DEBUGGING_RUNBOOK.md)
- Supabase-schema i repo kontra live
- explicita sanningskällor för varje viktig dataklass

Det här får inte bygga enbart på god vilja. Därför gäller följande arbetsregel:

- ingen schemaförändring är färdig utan migration + uppdaterad [supabase/schema.sql](/Users/t-nab/Documents/Gamification/supabase/schema.sql)
- ingen ny delad dataklass är färdig utan uppdaterad sanningskälla i [ARCHITECTURE.md](/Users/t-nab/Documents/Gamification/docs/ARCHITECTURE.md)
- ingen ny felsökningskänslig write-path är färdig utan en kort not i [DEBUGGING_RUNBOOK.md](/Users/t-nab/Documents/Gamification/docs/DEBUGGING_RUNBOOK.md)

Målet är inte byråkrati. Målet är att hindra att systemets verkliga arkitektur återigen börjar skilja sig från det som står i repo:t.

## Vad Som Aktivt Bör Undvikas

### 1. Att bygga fler rum innan de befintliga är sammanhängande

Fler flikar och fler specialytor gör appen rikare på pappret men svagare i vanan.

### 2. Att generalisera för andra grupper för tidigt

Nuvarande system vinner på precision för ett band. Den styrkan försvinner om modellen blir för generisk innan den är färdig.

### 3. Att jaga total teknisk renhet

Att försöka göra allt server-first eller allt immutabelt nu riskerar att stoppa produkten. Målet här är inte perfekt teori, utan robust tydlighet.

### 4. Att låta Drive, kalender eller coach bli separata produkter

De är värdefulla eftersom de förstärker HQ:s kärnloop, inte för att de i sig är fullvärdiga verktyg.

## Praktisk Färdplan

### Etapp 1: Konsolidera det som redan används

Fokus:

- Quests
- Aktivitet
- Band Hub
- notiser/push
- coachens närvaro i hem och quests

Definition:

- sociala signaler upplevs som pålitliga
- kalender och collab driver verklig återkomst
- appens viktigaste rum känns tydligt släkt

Ledande indikatorer:

- minst `3 av 5` centrala medlemssignaler landar i rätt yta utan manuell omväg: kommentar, collab-inbjudan, collab-framsteg, RSVP, check-in
- mediantid från quest-slutförande till första social respons är under `2 timmar` när bandet är aktivt samma dag
- minst `3 av 5` medlemmar öppnar appen utan push minst `4 dagar` under en aktiv vecka

Eftersläpande indikatorer:

- minst `60 %` av veckans verkliga bandinteraktioner som rör rep, uppdrag eller material går via HQ snarare än bara utanför appen
- senaste rep, nästa rep och ett relevant nästa steg kan nås från appen på under `30 sekunder`

Not:

- indikatorn om veckans verkliga bandinteraktioner är i den här fasen en `självskattad teamindikator`, inte en automatiserad systemmetrik
- den är fortfarande värdefull, eftersom den mäter om HQ faktiskt blir förstahandsvägen i vardagen, inte bara om appen används

### Etapp 2: Fördjupa beteendeloopen

Fokus:

- bättre reflektion
- bättre uppföljning på handling
- starkare koppling mellan idé, coach och quest
- bättre personlig läsning i Profil
- tydligare rytm i när coachen ska leda, följa upp och hålla sig i bakgrunden

Definition:

- medlemmen känner att appen förstår både vad som hänt och vad som bör hända nu

Ledande indikatorer:

- minst `50 %` av quest-completions följs av reflektion, social respons eller tydlig nästa handling i samma session
- coachens rekommendation leder till att medlemmen öppnar ett quest eller en relevant vy i mer än `40 %` av fallen där coachriktning visas tydligt

Eftersläpande indikatorer:

- minst `3 av 5` medlemmar använder appen varje vecka för både riktning och uppföljning, inte bara för att titta
- minst `1` återkommande arbetsvana i veckan kan kopplas till HQ hos varje aktiv medlem

### Etapp 3: Operativ förfining

Fokus:

- färre edge cases
- mindre arkitektonisk friktion
- tydligare inre kontrakt i systemet
- bättre ritning mellan personlig state och delad state

Definition:

- produkten känns mindre som “många smarta delar” och mer som ett sammanhängande operativsystem för bandet

Ledande indikatorer:

- nya interaktionsflöden kan klassificeras direkt som lokal-first eller server-first utan särskild arkitekturdiskussion
- buggar i sociala signaler kan spåras genom dokumenterad write-path utan ad hoc-kartläggning

Eftersläpande indikatorer:

- tiden från upptäckt till förklarad rotorsak för sociala buggar minskar tydligt
- repo, live-schema och faktisk signalmodell håller ihop över flera iterationer utan manuell schemajakt

För att detta ska vara meningsfullt måste en enkel baslinje börja samlas redan i Etapp 1:

- logga datum för upptäckt, förklarad rotorsak och löst status för sociala buggar som rör feed, notiser, kalender, collab eller push
- målet är inte tung incidenthantering, utan att skapa en jämförbar linje för om systemet faktiskt blir lättare att förstå

## Ekonomisk Nollkostnadsprincip

Den här strategin utgår från att ni inte behöver köpa er till nästa steg.

Det betyder i praktiken:

- använd befintlig Supabase- och Vercel-setup
- använd befintlig AI-integration mer träffsäkert i stället för bredare
- använd nuvarande Google-integrationer som förstärkare, inte som fulla system
- låt produktkvalitet komma från prioritering, inte inköp

Om någon del kräver pengar ska frågan vara:

`ersätter detta verklig produktklarhet eller försöker det dölja att kärnan inte sitter än?`

## Definition Av Framgång

Den realistiska strategin är lyckad när:

- minst `3 av 5` bandmedlemmar öppnar appen utan push-notis minst `4 dagar/vecka` under en normal aktiv period
- mediantid från quest-slutförande till första social respons är under `2 timmar` när bandet är i gång
- senaste rep, nästa rep och nästa viktiga uppdrag kan hittas inom `30 sekunder` från startskärmen
- notiser och social respons leder till faktisk återgång till rätt vy, inte bara läsning
- coachen används som riktning och inte bara som dekoration
- appen känns som ett levande vardagsrum, inte ett experiment

Det viktiga här är inte exakta slutgiltiga KPI:er. Det viktiga är att strategin nu går att bedöma som:

- `inte klar`
- `tillräckligt klar för att gå vidare`
- `fungerar i verkligt bruk`

## Slutlig Riktning

Med nuvarande system bör Sektionen HQ inte försöka bli störst.

Den bör försöka bli:

`det naturligaste sättet för ett band att hålla ihop riktning, vardag och rörelse`

Det är fullt realistiskt att bygga med det ni redan har.
