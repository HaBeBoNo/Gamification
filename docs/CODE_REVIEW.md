# Sektionen HQ -- Fullständig kodgranskning

**Datum:** 2026-04-06
**Scope:** Hela kodbasen efter omfattande refaktorering

---

## Sammanfattning

Sektionen HQ är en välbyggd gamification-plattform för bandoperationer (React 18 / TypeScript / Vite / Zustand / Supabase / Claude AI). Refaktoreringen dokumenterad i REFACTOR_REPORT.md har gjort stora framsteg -- TypeScript-migrering av 7 filer, Zustand för notifikationer, 5 extraherade hooks, renare separation of concerns. Genomlysningen identifierar dock ett antal problem som bör åtgärdas samt konkreta förslag på förbättringar med fokus på interaktivitet och UI/UX.

---

## 1. Kritiska problem

### 1.1 API-nyckel exponerad via VITE_-prefix

**Fil:** `api/claude.js` + `.env.local`

Miljövariabeln `VITE_ANTHROPIC_API_KEY` har prefixet `VITE_`, vilket gör att Vite bundlar den i klientkoden. Alla som inspekterar JS-bundlen i dist/ kan läsa nyckeln.

**Fix:** Byt namn till `ANTHROPIC_API_KEY` (utan VITE_-prefix). Serverless functions i Vercel har tillgång till server-side env vars utan prefix.

### 1.2 Muterbar global state (S-objektet)

**Fil:** `src/state/store.ts`

Hela appens state lever i ett muterbart singleton-objekt `S` som muteras direkt (`S.chars[id].xp += 10`). Detta bryter Reacts optimeringsmodell -- `React.memo`, `useMemo` och shallow comparison fungerar inte korrekt. Det gör också testning svår och möjliggör subtila buggar med stale state.

Migrationsplanen (Fas 1-4) är väldokumenterad men bara Fas 1 (notifikationer) är genomförd. Resterande faser bör prioriteras.

### 1.3 Race condition vid quest-completion

**Fil:** `src/components/game/QuestCard.tsx`

Det finns två parallella vägar till completion -- manuell och via AI-validering. Om användaren klickar "klar" medan AI-validering pågår kan båda exekvera. Ingen mutex eller disable-mekanism förhindrar detta. Knappen bör disablas med `disabled={thinking}` under AI-validering.

### 1.4 NaN-risk i streak-beräkning

**Fil:** `src/hooks/useXP.ts`

`Math.round((today.getTime() - prevDay.getTime()) / 86400000)` kraschar tyst om `prevQuestDate` är ett ogiltigt datum. Bör valideras innan beräkning.

### 1.5 Supabase-sync sväljer fel

**Fil:** `src/state/store.ts`

`supabaseSync()` har `.catch(() => {})` -- alla sync-fel ignoreras tyst. Användaren vet inte att data inte sparats. Bör visa felmeddelande + implementera retry-logik.

---

## 2. Strukturella problem

### 2.1 TypeScript strict mode avslaget

**Fil:** `tsconfig.json`

`"strict": false` betyder att null-referensfel, implicit `any`, och andra typfel inte fångas. Detta förklarar alla `S.me!`-assertions i kodbasen. Att slå på `strict: true` och fixa de ~50-100 felen som dyker upp är en av de mest värdefulla investeringarna.

### 2.2 JS-filer saknar typkontroll

`src/data/members.js`, `src/data/quests.js`, `src/lib/aiPrompts.js` typkontrolleras inte (`checkJs: false`). Dessa innehåller kärndata som quests och medlemmar. Bör migreras till TypeScript.

### 2.3 Hardkodade värden överallt

Några exempel:

- `SEASON_START_DATE = new Date('2026-03-01T00:00:00')` i store.ts
- `EMAIL_TO_MEMBER`-mappning i useAuth.ts (separat från members.js)
- AI-modell `claude-sonnet-4-20250514` hardkodad i api/claude.js
- `localStorage.getItem('sek-v6')` utan migrationsstrategi vid schemaändringar
- `.slice(0, 5)` för personal quests i QuestGrid utan förklaring

### 2.4 Ingen linting eller kodformatering

package.json saknar ESLint, Prettier och pre-commit hooks. Kodstilen är inkonsekvent (inline styles vs className, mixade konventioner).

### 2.5 Testsvit trasig och minimal

`useXP.test.js` markerad som "broken" i SPRINT_1_GITHUB.md. Vitest-miljön är satt till `node` istället för `jsdom`, vilket saknar DOM-API:er för komponenttester. Ingen testtäckning för feed-deduplicering, collaborative quests, AI-validering eller offline-beteende.

---

## 3. UI/UX-problem

### 3.1 Saknade loading states

Flera kritiska asynkrona operationer saknar visuell feedback:

- **Quest completion:** Inget visuellt medan XP beräknas och sparas
- **AI-validering:** `thinking`-state sätts men UI:t visar ingen spinner eller "AI granskar..."
- **Supabase sync:** Ingen indikation om att data synkas i bakgrunden
- **HomeScreen:** Ingen skeleton loader medan data hämtas
- **ActivityFeed:** Ingen laddningsindikator; visar tom yta

### 3.2 Otillräckliga mikro-interaktioner

- **LevelUpOverlay:** Ingen animation, inget ljud, ingen haptics. Dyker upp statiskt. Bör auto-dismissas efter 3 sekunder med en celebratory animation.
- **XPOverlay:** Saknar float-up + fade-out animation för XP-siffror
- **QuestCard:** Ingen visuell feedback vid long-press eller hover
- **BottomNav:** Inget aktivt state-transition (bara colorswap utan animation)
- **Pull-to-refresh:** Ingen visuell indikator under synken

### 3.3 Tillgänglighetsproblem

- **BottomNav fontstorlek:** 11px, under WCAG AA-minimum (12px). REFACTOR_REPORT säger "fixat från 9px till 11px" men målet bör vara 12px+
- **QuestCard:** REFACTOR_REPORT hävdar `role="button"`, `tabIndex={0}`, `aria-label` -- men dessa saknas i koden
- **QuestCompleteModal:** Stäng-knapp saknar `aria-label="Stäng"` och Escape-tangent
- **MetricsBar:** Horisontell scroll utan visuella indikatorer
- **Streak-ikon i Topbar:** Ingen tooltip som förklarar regler

### 3.4 Mobilanpassning

- **Topbar:** Hardkodad `height: 48px` tar inte hänsyn till `env(safe-area-inset-top)` på notch-telefoner
- **Modal max-width 420px:** För brett för iPhone SE (320px bred)
- **QuestCard padding:** Ser bra ut på 375px men trångt på 320px
- **BottomNav 56px + safe-area:** Tar mycket plats på små skärmar

### 3.5 Saknade UX-flöden

- **Ingen "sedan du var här sist"-sammanfattning** (noterad som TODO i SPRINT_1_GITHUB.md)
- **Ingen rekommenderad nästa quest** på hemskärmen
- **Ingen felhantering vid okänd email i useAuth** -- användaren ser blank laddningsskärm
- **Ingen 404-sida** -- Vercel visar default error page

---

## 4. Interaktivitetsförslag

Här följer konkreta förslag på förbättringar som höjer känslan av engagement och responsivitet.

### 4.1 Quest completion celebration flow

**Nuläge:** Quest markeras klar, XP adderas tyst, modal dyker upp statiskt.

**Förslag:**
1. Vid klick: knappen morphar till en laddnings-spinner (framer-motion `layoutId`)
2. XP-siffra "flyger" från quest-kortet till XP-räknaren i topbar med en arc-animation
3. Om level-up: skärmen pulserar kort med en glow-effekt + confetti-partiklar (lätt, CSS-baserat)
4. Haptic feedback via `navigator.vibrate([50])` på mobil
5. Quest-kortet kollapsar med en smooth exit-animation istället för att bara försvinna

### 4.2 Streak & momentum-visualisering

**Nuläge:** Streak visas som en siffra i Topbar utan kontext.

**Förslag:**
1. Streak-ikonen bör pulsera/glöda vid aktiv streak (CSS animation, inte JS)
2. Long-press på streak visar en mini-calendar med färgkodade aktiva dagar (liknande GitHub contribution graph)
3. "Streak i fara"-varning om användaren inte loggat aktivitet idag (subtil, inte påträngande)
4. Streak milestone-celebrations vid 7, 14, 30 dagar (kort overlay med badge)

### 4.3 Interaktiv activity feed

**Nuläge:** Feed visar poster i en platt lista utan interaktionsmöjligheter.

**Förslag:**
1. Swipe-to-react: svep höger på en feed-post för att ge high-five (haptic feedback)
2. Inline-kommentarer med expanderbar trådvy
3. "Typ-indikator" när annan bandmedlem skriver kommentar (via Supabase realtime)
4. Pull-to-refresh med en custom animation (t.ex. bandlogga som snurrar)
5. Lazy loading med IntersectionObserver istället för att rendera alla 50 poster

### 4.4 Drag-and-drop quest-prioritering

**Nuläge:** `@dnd-kit` finns i dependencies men SortableQuestList verkar grundläggande.

**Förslag:**
1. Drag-handle med visuell affordance (grip dots)
2. Smooth reorder-animation med framer-motion `Reorder`
3. Drop-to-category: dra quest mellan tabs (Personal / Daily / Strategic)
4. Drag-to-delegate: dra quest till en bandmedlems avatar för att delegera
5. Visuell "drop zone" highlight när man drar

### 4.5 AI Coach-interaktion

**Nuläge:** AICoach visar ett dagligt meddelande med en "Uppdatera"-knapp utan rate limiting.

**Förslag:**
1. Typing-animation när coach-meddelandet visas (streaming-känsla)
2. Quick-reply-knappar under meddelandet: "Berätta mer", "Ge mig en quest", "Hur går det för bandet?"
3. Context-aware nudges: "Du har 3 quests nära deadline" istället för generiska meddelanden
4. Coach-avatar med subtil idle-animation (breathing effect via CSS)
5. Rate limit: max 1 refresh per 30 sekunder med visuell cooldown-indikator

### 4.6 Onboarding & empty states

**Nuläge:** Onboarding.tsx finns men saknar kontext om empty states i övriga vyer.

**Förslag:**
1. Animerad onboarding med swipe-between-slides (3-4 steg)
2. Kontextuella empty states: "Inga quests klara än -- här börjar din resa!" med en CTA
3. First-quest wizard: guidar användaren genom första quest-completionen
4. Tooltip-tour vid första inloggning som visar nyckeldelar av UI:t
5. Progressive disclosure: visa avancerade features (AI Coach, Collaborative Quests) först efter level 3

### 4.7 Notifikations-förbättringar

**Nuläge:** Notification-system finns men read-state persisteras inte, IDs kan kollidera.

**Förslag:**
1. Notification badge med count i BottomNav: "MER (3)" istället för bara en prick
2. Swipe-to-dismiss på individuella notifikationer
3. Grupperade notifikationer: "Martin och 2 andra klarade quests" istället för 3 separata
4. Rich notifications med inline actions: "High-five tillbaka" direkt i notifikationen
5. Persisted read-state i localStorage (finns inte idag)
6. Byt `Date.now() + Math.random()` till `crypto.randomUUID()` för unika IDs

### 4.8 Offline experience

**Nuläge:** PWA konfigurerad men offline-upplevelsen är outvecklad.

**Förslag:**
1. OfflineBanner bör vara mer informativ: "Du är offline. Ändringar sparas lokalt."
2. Optimistic UI: quest-completions köas lokalt och synkas när nät finns
3. Visuell indikator på quests som slutförts offline (pending-sync ikon)
4. Offline-tillgänglig coach: visa senaste cachade meddelandet
5. Sync-status i ProfileView: "Senast synkad: 2 min sedan"

---

## 5. Rekommenderad prioritering

### Omedelbart (denna vecka)

1. Fixa API-nyckel-exponeringen (1 timme)
2. Disabla quest-knapp under AI-validering (30 min)
3. Lägg till error toast vid sync-fel (2 timmar)
4. Validera streak-datum mot NaN (1 timme)

### Sprint 1 (1-2 veckor)

1. Slå på TypeScript strict mode + fixa fel (3-5 dagar)
2. Quest completion celebration flow med animationer (2 dagar)
3. Loading skeletons på alla asynkrona vyer (1 dag)
4. Fixa tillgänglighetsproblem: aria-attribut, fontstorlekar, keyboard nav (1 dag)
5. Rate limiting på AI-anrop (2 timmar)

### Sprint 2 (2-4 veckor)

1. S -> Zustand Fas 2-3 migrering (1-2 veckor)
2. Interaktiv activity feed med swipe-to-react (3 dagar)
3. Streak-visualisering och milestones (2 dagar)
4. AI Coach typing-animation + quick-replies (2 dagar)
5. Skriv om trasiga tester + lägg till nya (3-5 dagar)

### Framtida

1. Drag-to-delegate quests
2. Offline queue med sync-status
3. Progressive onboarding
4. Fullständig S -> Zustand Fas 4
5. ESLint + Prettier + pre-commit hooks

---

## 6. Övriga observationer

- **README.md** innehåller bara "# Gamification" -- bör utökas med setup-instruktioner, arkitekturbeskrivning och bidragsguide
- **REFACTOR_REPORT.md** innehåller claims som inte stämmer med koden (t.ex. aria-attribut på QuestCard) -- bör verifieras
- **SPRINT_1_GITHUB.md** har 8 issues som inte skapats ännu. Scriptet `create_sprint1_github_issues.mjs` kräver `GITHUB_TOKEN`
- **dist/** finns i repo:t men bör ligga i .gitignore (byggas vid deploy)
- **.DS_Store** bör läggas till i .gitignore
- **6 Google Fonts** i index.html = ~6 HTTP-requests. Bör subsättas till kritiska weights + `font-display: swap`
