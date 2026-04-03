# State of the App — Sektionen HQ
### Strategic Architecture & UX Review · April 2026

---

## Executive Summary

Sektionen HQ is an ambitious and already impressive gamification platform built for an 8-member band. After a comprehensive review of ~50 components, 13 hooks, 12 utility modules, and the full data layer, I can say confidently: **you have a real product here, not a prototype.** The XP engine is mathematically sound and well-tested, the AI integration is thoughtful and layered, and the design system is cohesive. That said, the app is at an inflection point — the features are accumulating faster than the architecture can cleanly support them, and several user flows are either incomplete or disconnected from the core loop. Below is my honest assessment and a concrete plan forward.

---

## 1. THE FOUNDATION — What's Working Well

### XP Engine (useXP.ts) — The Crown Jewel
The separation of `calcAwardXP` (pure function) from `awardXP` (orchestrator) is textbook clean architecture. This is the most well-engineered part of the codebase. The escalating streak bonus curve (7/14/30 day tiers), role-type scaling (amplifier/enabler/builder), collaborative multipliers, and milestone bonuses create a genuinely engaging progression system. Crucially, it has **30+ unit tests** — the only part of the app with real test coverage. *Keep this. Protect this.*

### AI Integration (useAI.ts + claudeApi.ts + aiPrompts.js)
The three-layer AI architecture (HTTP client → prompt templates → game logic orchestrator) is well-separated. The AI validation flow that scores quest completions and proportionally awards XP is a killer feature — it makes the system feel alive and fair rather than a checkbox tracker. The graceful fallback (50% XP on AI failure) shows production thinking. The coach personalization via `ResponseProfile` and per-member coach names is a strong differentiator.

### Design System
The token-based CSS custom properties are comprehensive: color, typography (Space Grotesk / DM Sans / JetBrains Mono), spacing (4px grid), and animation easing curves. The dark-first aesthetic is consistent. The category color palette (wisdom blue, tech purple, social green, money amber, health red, global indigo) creates instant visual recognition. This is a solid foundation for scaling the UI.

### Data Model
The 108 base quests are well-structured with meaningful categorization across 6 categories, multiple quest types (standard/strategic/metric/hidden/ghost/sidequest), and recurrence support. The member profiles in `MEMBERS` with role types, XP scaling factors, and temporal work windows are thoughtful game design.

### Notification System
Fully migrated to Zustand — reactive, typed, with proper notification types (LEVEL_UP, STREAK, HIGH_FIVE, QUEST_COMPLETE). Web Push via Supabase Edge Functions. This is clean and done right.

### PWA & Offline
Service worker auto-update, install prompt, offline banner, network toast — the mobile experience fundamentals are in place. Pull-to-refresh and swipe navigation show attention to native-feel interactions.

---

## 2. THE MISSING PIECES — What to Add

### 2.1 Profile View (Critical Gap)
The profile tab currently renders a placeholder emoji and "Profilinställningar kommer snart." This is the most glaring gap in the UX. Every gamification app lives or dies on how satisfying it feels to see *your own progress*. This should be the single most rewarding screen in the app — a personal dashboard showing:

- Level, total XP, and XP-to-next with a progress ring
- Stat radar chart (vit/wis/for/cha)
- Streak calendar (like GitHub's contribution graph — you already have ActivityHeatmap)
- Quest completion rate and category breakdown
- Form tracker visualization (last 5 results, W/L streak)
- Temporal behavior pattern ("You're an early finisher" / "Deadline-driven")
- Earned badges and trophies (connect to TrophyRoom)
- Role calibration summary and coach relationship

### 2.2 Weekly Check-In / Checkout Flow
`S.weeklyCheckouts` exists as an empty object. There's no UI for it. A weekly reflection ritual would be hugely valuable both pedagogically and for engagement:

- "What did you accomplish this week?" (auto-populated from completed quests)
- Quick mood/energy check (1–5 scale)
- "What's your focus for next week?" (sets intent)
- Coach responds with a personalized insight based on the week's data
- Creates a recurring engagement hook that brings people back

### 2.3 Progress Milestones & Celebrations
The `LevelUpOverlay` and `RewardOverlay` exist but are only triggered by XP awards. There's no celebration for reaching meaningful milestones like: first quest completed, 10th quest, 50th quest, first streak of 7 days, full stat maxed, first collaborative quest, all daily quests done in a week. These micro-celebrations are the dopamine hooks that gamification depends on.

### 2.4 Quest Creation for All Members
`CreateQuestModal` exists but the ability for non-admin members to propose quests (subject to approval or peer validation) would increase ownership and engagement. Currently quests feel top-down — 108 pre-defined quests assigned to roles.

### 2.5 Social Interaction Layer
The delegation system (DelegationSheet/DelegationInbox) exists, but there's no lightweight way for members to interact: no high-fives, no comments on completed quests, no reactions to the activity feed. The `HIGH_FIVE` notification type exists but there's no UI to send one. Small social touches make the difference between a task tracker and a team game.

### 2.6 Onboarding Refinement
The onboarding flow (CoachCalibration with 5 questions) captures rich data, but there's no way to revisit or update these responses. People's motivations and energy drains change. A periodic "recalibration" prompt (quarterly?) would keep the AI coaching relevant.

---

## 3. THE EVOLUTION — What to Change

### 3.1 Index.tsx — The God Component (High Priority)
At 607 lines with 15+ pieces of local state, Index.tsx is doing too much. It manages:
- Authentication gating
- Tab navigation (both mobile and desktop, duplicated)
- All overlay/modal state (metrics, admin, command palette, notifications, quest detail, history, shortcuts, coach insight)
- Pull-to-refresh, swipe, long-press, keyboard shortcuts
- Service worker lifecycle

**Recommendation:** Extract into focused layers:
- `AppShell` — auth gate + service worker
- `NavigationProvider` — tab state, swipe, keyboard
- `OverlayManager` — all modal/overlay orchestration (you're already halfway there with `useOverlays`)
- `MainContent` — just renders the active tab

### 3.2 The S Singleton Migration (Medium Priority, High Impact)
The migration plan in `store.ts` is excellent and well-documented. Fas 1 (notifications) is done. But the remaining phases are stalling, and every new feature adds more mutations to `S`. The tick-counter reactivity pattern means **every `save()` re-renders every subscribed component** — there's no selective reactivity. As the app grows, this will become a performance cliff.

**Recommendation:** Prioritize Fas 2 (simple primitives: `S.me`, `S.tab`, `S.adminMode`) as a quick win. These are read-heavy, write-rare values that will immediately benefit from Zustand selectors. Don't attempt Fas 4 (chars/quests) until you have feature flags and parallel running — the plan is right.

### 3.3 TypeScript Gaps
`useXP.ts` is the core calculation engine but has **zero TypeScript parameter types** — all functions use implicit `any`. `QuestGrid` and `Index.tsx` are riddled with `any` casts. The type definitions in `game.ts` exist but aren't enforced at the boundaries where data enters the system.

**Recommendation:** Type the public API of `useXP.ts` and `useAI.ts` first. These are the highest-value targets because they're the most complex logic and the most likely to have subtle bugs.

### 3.4 Duplicate Mobile/Desktop Rendering
Index.tsx renders `QuestGrid` twice — once in `.desktop-content` and once in `getMobileContent()`. Same for `BandHub`. This means two component instances exist simultaneously, each with their own state. It's wasteful and can cause subtle sync bugs.

**Recommendation:** Use a single content renderer with CSS-driven responsive layout, or use a proper `useMediaQuery` hook to conditionally render one or the other.

### 3.5 Console Debug Logging in Production
Lines 186-192 of Index.tsx dump auth state on every render:
```
console.log('=== INDEX DEBUG ===');
console.log('authLoading:', authLoading);
...
```
These should be gated behind `import.meta.env.DEV` or removed entirely.

### 3.6 Quest Filtering Complexity
`QuestGrid` has two overlapping filter systems: `TABS` (personal/daily/strategic/hidden/sidequest/all) and `FILTERS` (alla/aktiva/veckovisa/strategiska/kreativa). The interaction between them is confusing — some tab filters overlap with the secondary filters (e.g., "strategic" tab + "strategiska" filter). Simplify to a single, coherent filter paradigm.

### 3.7 Feed Entry Schema Inconsistency
In `awardXP`, feed entries use `{ who, action, ts }`. In `awardInsightBonus`, they use `{ who, action, xp, time }`. The field name for timestamp differs (`ts` vs `time`). This will cause display bugs in ActivityFeed.

### 3.8 Hardcoded Admin Checks
`isAdmin = S.me === 'hannes'` and `isCurl = S.me === 'carl'` are scattered through the codebase. Extract to a role/permission system: `hasPermission(memberId, 'admin')` or at minimum `MEMBERS[id].permissions: string[]`.

---

## 4. PRIORITIZED ROADMAP

### Phase 1 — "Polish the Core Loop" (1–2 weeks)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1.1 | **Build the Profile view** — This is the single highest-impact missing feature. Use the existing Scoreboard, ActivityHeatmap, and TrophyRoom components as building blocks. | 🔴 Critical | Medium |
| 1.2 | **Extract Index.tsx into AppShell + NavigationProvider + OverlayManager** — Unblock all future work by making the main component maintainable. | 🔴 Critical | Medium |
| 1.3 | **Remove debug logging, fix feed schema inconsistency, eliminate duplicate renders** — Quick cleanup wins. | 🟡 High | Low |
| 1.4 | **Type the core hooks** (useXP, useAI) — Prevent regression bugs in the most complex logic. | 🟡 High | Low |

### Phase 2 — "Deepen Engagement" (2–3 weeks)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 2.1 | **Weekly Check-In flow** — Design and build the reflection ritual. Connect to coach AI for personalized weekly summaries. | 🔴 Critical | Medium |
| 2.2 | **Milestone celebrations system** — Define meaningful milestones, build trigger logic, create celebration overlays. | 🟡 High | Medium |
| 2.3 | **High-Five / social reactions** — Add the UI for sending high-fives and reacting to feed items. Notification type already exists. | 🟡 High | Low |
| 2.4 | **Simplify quest filtering** — Merge the two filter systems into one intuitive paradigm. | 🟢 Medium | Low |

### Phase 3 — "Scale the Architecture" (3–4 weeks)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 3.1 | **Zustand migration Fas 2** — Move `S.me`, `S.tab`, `S.adminMode`, `S.weekNum` to Zustand selectors. | 🟡 High | Low |
| 3.2 | **Permission system** — Replace hardcoded admin/role checks with a data-driven permission model. | 🟢 Medium | Low |
| 3.3 | **Quest proposal flow** — Let any member propose quests; admin or peer approval workflow. | 🟢 Medium | Medium |
| 3.4 | **Coach recalibration** — Periodic prompt to update onboarding responses and refresh the AI coaching model. | 🟢 Medium | Low |
| 3.5 | **Zustand migration Fas 3** — Metrics, feed, check-ins. | 🟡 High | Medium |

### Phase 4 — "The Full Migration" (When ready)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 4.1 | **Zustand Fas 4** — Chars and quests. Feature-flagged, parallel running. | 🟡 High | High |
| 4.2 | **Test coverage expansion** — Integration tests for AI flows, component tests for critical UI. | 🟢 Medium | High |
| 4.3 | **Performance audit** — Profile the tick-based re-render pattern under load with 8 active users. | 🟢 Medium | Medium |

---

## 5. THE IMMEDIATE NEXT MOVE

**Build the Profile view.** Here's why it should be first:

1. It's the most visible gap in the current UX — every other tab delivers value except Profile.
2. It requires no architectural changes — you can build it with existing data from `S.chars[me]`, existing components (ActivityHeatmap, TrophyRoom, SkillNodes), and the existing design system.
3. It gives every member an immediate reason to care about their progression — right now, the only way to see your stats is through the Scoreboard (which is team-focused) or the Topbar (which is minimal).
4. It sets up the foundation for Phase 2 features — weekly check-ins, milestones, and recalibration all naturally live on or connect to the profile.

The Profile view is both the quickest win and the highest-leverage investment for user engagement. Build it first, then tackle the Index.tsx refactor to make everything else easier.

---

*Report prepared for Hannes Norrby — Sektionen HQ Lead Product Architect review*
*Analysis based on full codebase review: 50+ components, 13 hooks, 12 lib modules, 108 quests, 8 member profiles*
