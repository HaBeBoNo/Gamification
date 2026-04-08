# Sektionen HQ — Baslinje Och Incidentlogg

## Syfte

Det här dokumentet stödjer Block 1 i den realistiska strategin.

Det finns för att skapa en liten, användbar baslinje för:

- hur appen öppnas
- hur snabbt social respons kommer på en medlems handling
- hur lång tid det tar att förstå sociala buggar

Det är inte ett analytics-program.
Det är ett minimalt underlag för att kunna säga om Etapp 1 blir bättre eller bara känns bättre.

## Vad Som Mätas Automatiskt

### 1. Appöppning: push eller direkt

Källa:

- [src/lib/productBaseline.ts](/Users/t-nab/Documents/Gamification/src/lib/productBaseline.ts)
- [src/pages/Index.tsx](/Users/t-nab/Documents/Gamification/src/pages/Index.tsx)
- [src/service-worker.js](/Users/t-nab/Documents/Gamification/src/service-worker.js)

Vad som loggas:

- medlem
- tid
- öppningskälla: `push` eller `direct`
- aktuell väg

Begränsning:

- det här är `device-local baseline`, inte en gemensam sanning för hela bandet
- den är tillräcklig för att se om appen används spontant på en enhet, men inte för full teamanalys

### 2. Första sociala respons på en medlems aktivitet

Källa:

- [src/lib/productBaseline.ts](/Users/t-nab/Documents/Gamification/src/lib/productBaseline.ts)
- [src/hooks/useSocialNotifications.ts](/Users/t-nab/Documents/Gamification/src/hooks/useSocialNotifications.ts)

Vad som loggas:

- medlem
- feed item
- första observerade sociala respons
- handlingstid
- responstid
- latency i millisekunder

Begränsning:

- detta mäter första observerade sociala respons för feed-burna aktiviteter
- det är en relevant proxy för “handling -> social respons”, men inte en universell modell för alla signaler i hela appen

## Vad Som Är Självskattning

Följande Etapp 1-indikatorer är inte automatiserade och ska behandlas som kvalitativ eller manuell baslinje:

- andel verkliga bandinteraktioner som går via HQ snarare än utanför appen
- om senaste rep, nästa rep och nästa viktiga uppdrag upplevs som snabbare att hitta i HQ än utanför HQ
- om sociala signaler upplevs som pålitliga i verkligt bruk

De här ska inte döljas bakom låtsasprecision.
Om de används i beslutsfattande ska det stå tydligt om de kommer från:

- egen observation
- gemensam avstämning i bandet
- manuell testgenomgång

## Incidentlogg

Följande logg används för buggar som rör:

- feed
- notiser
- kalender
- collab
- push

Minsta fält:

| Datum upptäckt | Område | Kort symptom | Förklarad rotorsak | Datum rotorsak | Löst datum | Not |
| --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | notifications | exempel | exempel | YYYY-MM-DD | YYYY-MM-DD | valfri |

## Arbetsregel

När en social eller interaktiv bugg uppstår:

1. lägg in en rad i den här loggen
2. klassificera buggen via [DEBUGGING_RUNBOOK.md](/Users/t-nab/Documents/Gamification/docs/DEBUGGING_RUNBOOK.md)
3. fyll i `Datum rotorsak` när orsaken faktiskt är förstådd
4. fyll i `Löst datum` när fixen är verifierad

Det här är till för att skapa en enkel baslinje för Etapp 3.

## Första Baslinjefrågor

Före vidare optimering bör ni kunna svara på:

- öppnas appen oftare direkt än via push för de mest aktiva medlemmarna?
- hur lång är ungefärlig latens från handling till första social respons?
- vilka delar av signalflödet orsakar flest faktiska felsökningsärenden?

Om ni inte kan svara på dessa frågor ännu är det inte ett misslyckande.
Det är exakt därför Block 1 finns.
