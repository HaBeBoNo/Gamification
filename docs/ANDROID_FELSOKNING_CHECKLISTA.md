# Android-felsökningschecklista

Det här dokumentet är till för när en Android-medlem, till exempel Johannes, upplever fler buggar än iPhone-användare i HQ.

Målet är inte att "bevisa att Android är problemet", utan att snabbt avgöra om felet sannolikt sitter i:

- lokal state som glidit iväg
- service worker / PWA-cache
- push / notisbehörigheter
- auth / Google-session
- touch / livscykel på Android Chrome

## Grundprincip

Börja alltid med att avgöra om buggen är:

1. `konto-/databunden`
2. `enhetsbunden`
3. `installationsbunden`

Om samma konto fungerar bättre på annan enhet är problemet sannolikt lokalt på klienten.
Om annan medlem på Android ser samma sak är det mer sannolikt Android/PWA-relaterat.

## Del 1: Snabb triage

Samla först in detta, utan att ändra något:

- Vilken vy var Johannes i när buggen hände?
- Vad förväntade han sig skulle hända?
- Vad hände faktiskt?
- Exakt ungefär vilken tid skedde det?
- Var appen öppnad som installerad app eller i Chrome-flik?

Om möjligt: ta en skärminspelning eller skärmdump innan någon återställning görs.

## Del 2: Fastställ körsätt

Kontrollera vilket av dessa som gäller:

- `Installerad PWA från hemskärmen`
- `Chrome-flik`

Det här är viktigt eftersom service worker, cache och push beter sig annorlunda i installerat läge än i vanlig flik.

## Del 3: Minsta återställning först

Gör dessa steg i ordning och stanna så fort problemet försvinner.

### A. Hård omladdning

Om appen körs i Chrome-flik:

- stäng fliken helt
- öppna appen igen från länken
- kontrollera om problemet kvarstår

Om appen körs som installerad PWA:

- stäng appen helt från appväxlaren
- öppna den igen
- kontrollera om problemet kvarstår

### B. Logga ut och in igen

Gör detta om:

- Drive beter sig konstigt
- Google-koppling känns trasig
- data känns gammal eller delvis fel

Steg:

- logga ut i appen
- öppna appen igen
- logga in på nytt
- ge relevanta behörigheter igen om Android frågar

### C. Rensa lokal drift utan total ominstallation

Om problemet fortfarande finns:

- öppna appen i Chrome
- gå till webbplatsinfo / Site settings
- rensa `storage`, `cache` och gärna service worker för domänen
- öppna appen igen och logga in

Det här är det bästa testet för att avgöra om felet satt i lokal state eller PWA-cache.

### D. Ominstallera den installerade appen

Om Johannes kör HQ som installerad app:

- avinstallera appen från Android
- öppna HQ i Chrome igen
- installera om från nytt
- logga in på nytt

Om problemet försvinner här men inte i steg C, pekar det starkt mot PWA-/installationsdrift.

## Del 4: Android-specifika kontroller

Gör dessa om push, live-status eller bakgrundsbeteende känns opålitligt.

### Push och notiser

Kontrollera:

- att Chrome eller den installerade appen har tillåtelse att skicka notiser
- att Android inte blockerat notiser för appen
- att batterioptimering inte begränsar bakgrundsbeteende för Chrome

Fråga också:

- kommer pushar inte alls?
- kommer de sent?
- öppnar de fel plats?
- kommer de men in-app-notisen saknas?

Det sista tyder ofta på att push fungerar men att lokal eller remote notissynk inte gör det.

### Chrome-version

Kontrollera att Johannes kör en uppdaterad Chrome-version.

Gamla Android Chrome-versioner ger oftare konstigheter kring:

- install prompt
- service worker
- push
- OAuth-popupflöden

## Del 5: Så avgör du var felet sitter

### Om buggen försvinner efter att storage/cache rensats

Trolig orsak:

- lokal state eller service worker-drift

Tolkning:

- problemet är sannolikt inte "Android som plattform"
- det är en klient som glidit lokalt

### Om buggen finns kvar efter rensning men försvinner efter ny inloggning

Trolig orsak:

- auth-/sessionproblem
- utgången Google- eller Supabase-session

### Om buggen bara gäller push/notiser

Trolig orsak:

- Android-notisbehörighet
- Chrome/PWA pushregistrering
- bakgrundsbegränsning

### Om buggen bara gäller scroll, swipe eller modalbeteende

Trolig orsak:

- Android Chrome touch/livscykel
- layout- eller touch-action-beteende

### Om samma konto fungerar bättre på annan enhet

Trolig orsak:

- lokal drift på just Johannes telefon

### Om flera Android-användare får samma fel

Trolig orsak:

- verklig Android/PWA-specifik bug

## Del 6: Reproduktionslogg för varje incident

När Johannes rapporterar ett fel, logga detta:

- datum och ungefärlig tid
- vy: `Hem`, `Quests`, `Aktivitet`, `Band Hub`, `Coach`
- installerad app eller webbläsare
- Android-version om känt
- Chrome-version om känt
- exakt symptom
- om push/notis var inblandad
- om problemet överlevde:
  - omstart av app
  - utloggning/inloggning
  - rensad site data
  - ominstallation

Detta räcker ofta för att avgöra om det är:

- lokal klientdrift
- Android/PWA-specifikt
- eller ett allmänt produktfel som bara råkade upptäckas på Android först

## Rekommenderad ordning i praktiken

När Johannes hittar en ny bugg:

1. dokumentera symptom och tid
2. avgör installerad app eller Chrome-flik
3. testa omstart
4. testa utloggning/inloggning
5. testa rensad site data
6. testa ominstallation om installerad PWA
7. först därefter: behandla det som möjlig Android-specifik produktbugg

## Arbetsbedömning

Utifrån nuvarande arkitektur är den mest sannolika förklaringen inte "Android i sig", utan:

- Android gör PWA-/service-worker-lagret mer aktivt
- därför märks lokal drift, cache och sessionproblem tydligare där

Det betyder att Johannes mycket väl kan vara en kanariefågel för verkliga klientproblem, även om de inte är strikt Android-exklusiva.
