# Sektionen HQ — Refactor Report
**Prepared for:** Lead Architect
**Branch:** `main` (3 commits ahead of `origin/main`, plus unstaged working-tree changes)
**Scope:** GitHub Copilot audit remediation — Tier 1 (Quick Wins), Tier 2 (Structural Extraction), Tier 3 (Deep Refactoring)
**TypeScript check:** `npx tsc --noEmit` exits clean (0 errors)

---

## Table of Contents
1. [New Files Created](#1-new-files-created)
2. [Files Deleted](#2-files-deleted)
3. [Files Significantly Rewritten](#3-files-significantly-rewritten)
4. [Files Modified (Targeted Changes)](#4-files-modified-targeted-changes)
5. [Infrastructure Changes](#5-infrastructure-changes)
6. [Tier-by-Tier Change Log](#6-tier-by-tier-change-log)
7. [Architectural Impact Summary](#7-architectural-impact-summary)
8. [Known Limitations & Next Steps](#8-known-limitations--next-steps)

---

## 1. New Files Created

### State & Types
| File | Lines | Purpose |
|------|-------|---------|
| `src/types/game.ts` | 146 | Single source of truth for shared TypeScript interfaces: `Notification`, `CharData`, `CharStats`, `CharPts`, `TemporalBehavior`, `Quest`, `Metrics`, `FeedEntry`, `ResponseProfile`, `GameStoreState` |
| `src/state/store.ts` | 205 | TypeScript rewrite of `store.js`. Adds `notifications: Notification[]` slice to Zustand. Includes full 4-phase S→Zustand migration roadmap in structured JSDoc comment |
| `src/state/notifications.ts` | 154 | TypeScript rewrite of `notifications.js`. Pub/sub pattern replaced with Zustand backing store (`useGameStore.setState`). All public API functions preserved for backward compatibility |

### Custom Hooks
| File | Lines | Purpose |
|------|-------|---------|
| `src/hooks/useOverlays.ts` | 53 | Owns the 5 overlay states (`levelUp`, `reward`, `xpAmount`, `refreshMsg`, `sidequestNudge`) previously scattered across `Index.tsx`. Exposes stable `useCallback`-wrapped setters and `closeOverlays()` |
| `src/hooks/usePullToRefresh.ts` | 55 | Owns pull-to-refresh state + 3 refs + 3 touch handlers. Imports `syncFromSupabase` (moved out of `Index.tsx`) |
| `src/hooks/useSwipeNavigation.ts` | 49 | Owns swipe-tab navigation. Named constants `MIN_DELTA_PX=50`, `MIN_VELOCITY=0.3`. Stable `handleTouchStart`/`handleTouchEnd` via `useCallback` |
| `src/hooks/useLongPress.ts` | 38 | Ref-callback hook for long-press detection. Accepts `onLongPress` callback + `enabled` boolean. Replaces 15-line inline `logoLongPressRef` in `Index.tsx` |
| `src/hooks/useFocusTrap.ts` | 68 | Traps Tab/Shift+Tab within a container. Focuses first focusable element on mount. Restores focus to previous element on unmount. Used by `QuestCompleteModal` |
| `src/hooks/useXP.ts` | 395 | TypeScript rewrite of `useXP.js` with T3-C refactor: `calcAwardXP()` extracted as pure function; `awardXP()` is now a thin side-effect orchestrator |
| `src/hooks/useAI.ts` | 242 | TypeScript rewrite of the already-thinned `useAI.js` orchestration layer |
| `src/hooks/useCheckIn.ts` | ~65 | TypeScript rewrite of `useCheckIn.js`. Adds missing `stars` and `personal` fields; fixes `awardXP` call signature |
| `src/hooks/useResponseProfile.ts` | ~55 | TypeScript rewrite of `useResponseProfile.js`. Now imports `callClaude`/`parseJSON` from `claudeApi.ts` instead of raw `fetch`. Exports `ResponseProfile` type from `types/game.ts` |
| `src/hooks/useCoachCalibration.ts` | (existing, modified) | Updated imports to use `ResponseProfile` from `types/game.ts`; casts typed correctly |

### Library
| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/utils.ts` | ~10 | `cn()` utility: `clsx` + `tailwind-merge` for safe class composition |
| `src/lib/claudeApi.ts` | ~45 | TypeScript rewrite of `claudeApi.js`. Typed return values for `callClaude()`, `parseJSON<T>()`, `ts()` |
| `src/lib/aiPrompts.js` | (existing from prior split) | All Claude prompt templates and coach identity constants, extracted from `useAI.js` |

### PWA
| File | Lines | Purpose |
|------|-------|---------|
| `src/service-worker.js` | ~55 | New Workbox-powered service worker (source for `vite-plugin-pwa` injectManifest). Includes: Workbox precaching, NetworkFirst for `/api/*`, StaleWhileRevalidate for CDN, and the existing push notification handlers migrated from `public/sw.js` |

---

## 2. Files Deleted

| File | Reason |
|------|--------|
| `src/state/store.js` | Replaced by `store.ts` |
| `src/state/notifications.js` | Replaced by `notifications.ts` |
| `src/hooks/useXP.js` | Replaced by `useXP.ts` |
| `src/hooks/useAI.js` | Replaced by `useAI.ts` |
| `src/hooks/useCheckIn.js` | Replaced by `useCheckIn.ts` |
| `src/hooks/useResponseProfile.js` | Replaced by `useResponseProfile.ts` |
| `src/lib/claudeApi.js` | Replaced by `claudeApi.ts` |
| `public/sw.js` | Replaced by `src/service-worker.js` (Workbox-compiled output at `dist/sw.js`) |
| `src/App.css` | Confirmed Vite boilerplate with zero imports across the repo. Dead code removed |

---

## 3. Files Significantly Rewritten

### `src/hooks/useXP.ts` (T3-C — Pure/Side-effect Split)
**Before:** 304-line monolith. `awardXP()` performed 13 responsibilities in one function (streak calc, level-up loop, stat increments, feed write, push notification, reward roll, overlay callbacks, `save()`).

**After:** Architecture split into two layers:

- **`calcAwardXP(c, m, q, xpEarned, memberId)`** — Pure function. No mutation, no side-effects. Returns `{ totalXP, leveled, newLevel, newStreak, statInc, workPts, milestoneWorkBonus, feedAction }`. Can be unit-tested in isolation.
- **`awardXP(q, xpEarned, event, showLU?, showRW?, showXPPop?, rollReward?)`** — Orchestrator. Calls `calcAwardXP`, applies result to `S`, fires notifications, push, overlays, then `save()`. All callback params are now optional (typed with `?`).

Additional export: `awardInsightBonus(questId, insight, questTitle)` — awards +15 XP for reflection, extracted from `QuestCompleteModal`.

### `src/hooks/useAI.ts` (Thin Orchestration)
**Before:** 541-line monolith mixing HTTP, prompt templates, and game logic.

**After (across 3 files):**
- `claudeApi.ts` — HTTP client only (`callClaude`, `parseJSON`, `ts`)
- `aiPrompts.js` — All prompt templates and coach identity constants
- `useAI.ts` — ~242 lines of pure orchestration. Imports from both. Re-exports `DEFAULT_COACH_NAMES`, `WELCOME_MESSAGES`, `buildCoachPrompt` for backward compatibility with consumers.

### `src/state/notifications.ts` (T3-A — Zustand Backing Store)
**Before:** Custom pub/sub using a `Set` of listener functions and a mutable `notifications[]` array. Consumers had to call `subscribeNotifications(fn)` + `useState` to be reactive.

**After:** All mutation goes through `useGameStore.setState(s => ({ notifications: [...] }))`. `subscribeNotifications` is preserved as a thin `useGameStore.subscribe` wrapper for backward compatibility but no longer needed by any first-party consumer. `getNotifications()` and `getUnreadCount()` read from `useGameStore.getState()` synchronously.

---

## 4. Files Modified (Targeted Changes)

### `src/pages/Index.tsx` — God Component Reduction
The Index component has shed significant weight across Tier 1, 2, and the notification work:

**Removed:**
- 5 `useState` calls for overlays (`levelUp`, `reward`, `xpAmount`, `refreshMsg`, `sidequestNudge`) → `useOverlays()`
- 1 `useState` for `refreshing` + 3 pull-to-refresh refs + 3 handlers → `usePullToRefresh(S.me)`
- 3 swipe refs + `SWIPE_TAB_IDS` constant + 2 swipe handlers → `useSwipeNavigation(mobileTab, handleTabTap)`
- 15-line `logoLongPressRef useCallback` → `useLongPress(() => setShowAdminCenter(true), isAdmin)`
- `useState(getUnreadCount())` + `useEffect subscribeNotifications(...)` pattern → single Zustand selector
- `syncFromSupabase` import (moved into `usePullToRefresh`)
- `save(); notify()` in `openNotifications()` — replaced with `markAllRead()` (single call, no S mutation)

**Added:**
- `const unreadCount = useGameStore(s => s.notifications.filter(n => !n.read).length)` — reactive, no subscription overhead
- `id="main-content"` on the body-grid div (skip-nav target)
- `handleQuestTap = useCallback(...)`, `handleOpenCoach = useCallback(...)` — stable props for `React.memo` boundaries
- `keyboardHandlers = useMemo(...)` — stabilizes the handlers object passed to `useKeyboardShortcuts`
- `showSidequestNudge` stable callback from `useOverlays` wired into all inline lambda props

### `src/components/game/NotificationBell.tsx`
Replaced `useState(getUnreadCount()) + useEffect(subscribeNotifications(...))` with `useGameStore(s => s.notifications.filter(n => !n.read).length)`. Pulse animation preserved via `useRef` for prev-count comparison. `useEffect` removed entirely.

### `src/components/game/NotificationPanel.tsx`
Replaced `useState(getNotifications()) + useEffect(subscribeNotifications(...))` with `useGameStore(s => s.notifications)`. Removed `useState`, `useEffect`, `getNotifications`, and `subscribeNotifications` imports. `markAllRead` and `markRead` retained for user action handlers. Payload field access typed with `str()` cast helper.

### `src/components/game/QuestCompleteModal.tsx`
Replaced 12-line inline XP-award block (insight bonus) with single call to `awardInsightBonus(quest.id, unexpected, quest.title)`. Added `useFocusTrap`, `role="dialog"`, `aria-modal="true"`, `aria-label="Quest genomfört"`.

### `src/components/game/QuestCard.tsx`
- Added keyboard accessibility: `role="button"`, `tabIndex={0}`, `aria-label`, `onKeyDown` for Enter/Space.
- Fixed `completeCollaborativeQuest` call — was passing `(quest, rerender)` (wrong args); now correctly passes `(quest, quest.participants || [], quest.xp || 30)`. This was a silent runtime bug exposed by TypeScript.
- Wrapped in `React.memo`.

### `src/components/game/BottomNav.tsx`
- Added `role="tablist"` on `<nav>`, `role="tab"` + `aria-selected` + `aria-current="page"` on each button.
- Font size corrected: `9px → 11px` (below WCAG minimum threshold).

### `src/components/game/QuestGrid.tsx`, `Scoreboard.tsx`, `LeaderboardView.tsx`, `ActivityFeed.tsx`
All wrapped in `React.memo`. These were re-rendering on every `save()` tick regardless of whether their props changed.

### `src/components/game/CalendarView.tsx`
Fixed two silent bugs revealed by strict typing:
- `c.totalXP` (wrong capitalisation — data was accumulating to a dead key) → `c.totalXp`
- `ts: Date.now()` (number) in a `FeedEntry.ts: string` field → corrected to `toLocaleTimeString`

### `src/components/game/CoachChat.tsx` & `CoachInsightModal.tsx`
Added `as string` cast on `S.chars[S.me]?.coachName` — previously typed as `unknown` through the `[key: string]: unknown` index signature; now correctly surfaced as a string.

### `src/components/game/AdminPanel.tsx`
`handleResetQuests()` — `BASE_QUESTS.map(...)` cast via `(BASE_QUESTS as unknown[]).map(...)` to avoid `recur: string` → `'none' | 'daily' | 'weekly'` assignability error.

### `src/main.jsx`
Added `<React.StrictMode>` wrapper around `<Index />`. Enables double-invocation detection in development.

### `index.html`
Added skip-navigation link as the first child of `<body>`:
```html
<a href="#main-content" class="sr-only focus:not-sr-only ...">Hoppa till innehåll</a>
```

---

## 5. Infrastructure Changes

### `public/manifest.json`
Split `"purpose": "any maskable"` (invalid combined value) into separate icon entries per PWA spec:
```json
{ "purpose": "any" },
{ "purpose": "maskable" }
```

### `vite.config.js`
Added `VitePWA` plugin in `injectManifest` mode:
- Source SW: `src/service-worker.js`
- Output: `dist/sw.js` (Workbox-compiled with precache manifest injected)
- `manifest: false` — preserves existing hand-authored `public/manifest.json`
- `globPatterns`: JS, CSS, HTML, icons, fonts
- `devOptions.enabled: false` — SW not active in dev mode to avoid cache interference

### `vercel.json`
**Before:** A catch-all rule applied `no-cache, no-store, must-revalidate` to every URL including fonts, icons, and `manifest.json`.

**After:** Explicit, correct cache policies per resource type:

| Resource | Cache-Control |
|----------|--------------|
| `/assets/*` | `public, max-age=31536000, immutable` (unchanged — content-hashed) |
| `/icons/*` | `public, max-age=86400, stale-while-revalidate=604800` |
| `/manifest.json` | `public, max-age=86400, stale-while-revalidate=604800` |
| `/sw.js` | `no-cache, no-store, must-revalidate` + `Service-Worker-Allowed: /` |
| `/index.html` | `no-cache, no-store, must-revalidate` |

The old catch-all `no-cache` rule is removed.

### `package.json` / `package-lock.json`
Dependencies added:
- `vite-plugin-pwa`
- `workbox-precaching`
- `workbox-routing`
- `workbox-strategies`

### `src/state/store.ts` — Migration Roadmap Comment
A structured 4-phase migration plan is documented at the top of `store.ts`:

- **Fase 1** (done): `notifications[]` → `useGameStore.notifications`
- **Fase 2** (~1 day): Simple primitives (`S.me`, `S.tab`, `S.adminMode`, `S.weekNum`)
- **Fase 3** (~2 days): Complex objects (`S.metrics`, `S.feed`, `S.checkIns`, `S.weeklyCheckouts`)
- **Fase 4** (~1–2 weeks, high-risk): `S.chars{}`, `S.quests[]` — requires feature-flag and parallel run

---

## 6. Tier-by-Tier Change Log

### Tier 1 — Quick Wins (8 steps)
| ID | Change | File(s) |
|----|--------|---------|
| T1-A | Deleted `App.css` dead code | `src/App.css` (deleted) |
| T1-B | Added `React.StrictMode` | `src/main.jsx` |
| T1-C | Created `cn()` utility | `src/lib/utils.ts` |
| T1-D | Fixed PWA manifest icon `purpose` field | `public/manifest.json` |
| T1-E | Added 1 500 ms trailing debounce to `supabaseSync` | `src/state/store.ts` |
| T1-F | Added ARIA roles on BottomNav; font-size `9px → 11px` | `src/components/game/BottomNav.tsx` |
| T1-G | Added skip-navigation link | `index.html` |
| T1-H | Stabilized keyboard handler object with `useMemo` | `src/pages/Index.tsx` |

### Tier 2 — Structural Extraction (5 steps)
| ID | Change | File(s) |
|----|--------|---------|
| T2-A | Extracted `useOverlays` hook | `src/hooks/useOverlays.ts`, `src/pages/Index.tsx` |
| T2-B | Extracted `usePullToRefresh` hook | `src/hooks/usePullToRefresh.ts`, `src/pages/Index.tsx` |
| T2-C | Extracted `useSwipeNavigation` hook | `src/hooks/useSwipeNavigation.ts`, `src/pages/Index.tsx` |
| T2-D | Extracted `useLongPress` hook | `src/hooks/useLongPress.ts`, `src/pages/Index.tsx` |
| T2-E | Split `useAI.js` into 3 files; added `useFocusTrap`; `React.memo` on 4 components; keyboard nav on `QuestCard`; `awardInsightBonus` extracted to `useXP` | Multiple |

### Tier 3 — Deep Refactoring (6 steps)
| ID | Change | File(s) |
|----|--------|---------|
| T3-A | Migrated `notifications.js` pub/sub to Zustand slice | `src/state/notifications.ts`, `src/state/store.ts` |
| T3-B | Documented S → Zustand migration roadmap | `src/state/store.ts` |
| T3-C | Split `awardXP()` into pure `calcAwardXP` + orchestrator | `src/hooks/useXP.ts` |
| T3-D | Replaced `subscribeNotifications` consumers with Zustand selectors | `Index.tsx`, `NotificationBell.tsx`, `NotificationPanel.tsx` |
| T3-E | Installed `vite-plugin-pwa`; new `src/service-worker.js`; fixed `vercel.json` | `vite.config.js`, `vercel.json`, `src/service-worker.js`, `public/sw.js` (deleted) |
| T3-F | Migrated 7 `.js` files to `.ts`; created `src/types/game.ts`; fixed 4 pre-existing silent bugs | All JS→TS renames + `src/types/game.ts` |

---

## 7. Architectural Impact Summary

### Before vs. After: `src/pages/Index.tsx`
| Metric | Before | After |
|--------|--------|-------|
| Approximate size | ~23 KB | ~16 KB |
| `useState` calls | ~20 | ~14 |
| `useRef` calls | ~8 | ~3 |
| Custom hooks consumed | 2 | 8 |
| Inline event handler definitions | ~12 | ~4 |
| Notification subscription pattern | `subscribeNotifications` + `useState` | Single Zustand selector |

### Reactivity Model: Notifications
| Before | After |
|--------|-------|
| Manual `Set<fn>` listeners | Zustand store slice |
| `subscribeNotifications` + `useState` in every consumer | `useGameStore(s => s.notifications...)` selector |
| `getUnreadCount()` / `getNotifications()` sync reads from mutable array | Same API, reads from `useGameStore.getState()` |
| 3 components each managing their own subscription lifecycle | 0 subscriptions; Zustand handles all re-renders |

### TypeScript Coverage
| Before | After |
|--------|-------|
| `store.js`, `notifications.js`, `useXP.js`, `useAI.js`, `useCheckIn.js`, `useResponseProfile.js`, `claudeApi.js` — plain JS, no type checking | All migrated to `.ts` |
| No shared type definitions | `src/types/game.ts` — 146 lines, 9 interfaces |
| `tsc --noEmit`: unknown number of pre-existing errors | `tsc --noEmit`: **0 errors** |

### Silent Bugs Fixed by TypeScript Migration
| Bug | Location | Impact |
|-----|----------|--------|
| `c.totalXP` (wrong capitalisation) — XP was silently accumulating to a dead key on char object | `CalendarView.tsx` | Data correctness |
| `ts: Date.now()` (number) written into a string field in feed entries | `CalendarView.tsx` | Data correctness |
| `completeCollaborativeQuest(quest, rerender)` — rerender function passed as `participants[]` | `QuestCard.tsx` | Collaborative XP never distributed to participants |
| Date arithmetic `today - prevDay` without `.getTime()` — result was `NaN` in strict mode | `useXP.ts` | Streak calculation could produce `NaN` |

---

## 8. Known Limitations & Next Steps

### Not Changed (by design)
- **`S` mutable singleton** — Migration roadmap documented in `store.ts` (Phases 1–4). Phase 1 (notifications) complete. Phases 2–4 require dedicated sprint.
- **`aiPrompts.js`** — Remains JavaScript. Template literals and string constants don't benefit significantly from TypeScript; migration deferred.
- **`useAI.ts` AI orchestration** — Still uses `S.me!` non-null assertions. Clean-up follows S → Zustand Phase 2 migration.
- **PWA: `vite-plugin-pwa` dev mode disabled** — `devOptions.enabled: false` to avoid cache interference during development. Enable with `type: 'module'` for SW integration testing.

### Recommended Next Actions
1. **Push and deploy** — Verify PWA install prompt, Workbox precaching, and push notification flow in staging.
2. **Unit test `calcAwardXP`** — Now a pure function; no mocking required. Verify streak edge cases and level-up boundary conditions.
3. **S → Zustand Phase 2** — Migrate `S.me`, `S.tab`, `S.adminMode` to Zustand slices (estimated 1 day).
4. **`aiPrompts.js` → `aiPrompts.ts`** — Low-effort, high-completeness improvement for full TS coverage.
5. **`useCoachCalibration.ts`** — Still uses raw `fetch` instead of `callClaude` from `claudeApi.ts`. Trivial migration, same pattern as `useResponseProfile.ts`.
