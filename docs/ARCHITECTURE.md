# Sektionen HQ — Architecture

## Purpose

Sektionen HQ is a band operations system, not a generic productivity app.

Its core loop is:

1. The coach frames what matters now.
2. A member acts through quests or calendar participation.
3. The system records progress and social signals.
4. The band sees and reacts.
5. The member gets a next step.

The architecture should therefore optimize for:

- stable personal progression
- reliable social signaling
- low-friction mobile use
- clear separation between personal state and shared state

## Current Architecture Summary

The system is intentionally hybrid today.

- Personal game state is local-first and centered around the mutable singleton `S` in [src/state/store.ts](/Users/t-nab/Documents/Gamification/src/state/store.ts).
- Shared social state is increasingly server-owned in Supabase tables such as `activity_feed`, `notifications`, `feed_reactions`, `feed_witnesses`, and `member_presence` in [supabase/schema.sql](/Users/t-nab/Documents/Gamification/supabase/schema.sql).
- `member_data.data` is still used as a broad persistence envelope for per-member game state in [src/hooks/useSupabaseSync.ts](/Users/t-nab/Documents/Gamification/src/hooks/useSupabaseSync.ts).

This is not a pure local-first architecture and not a pure server-first architecture.
It is a controlled hybrid and must be treated as such.

## Source Of Truth Matrix

| Data class | Canonical source | Local projection/cache | Main writers | Main readers | Notes |
| --- | --- | --- | --- | --- | --- |
| Auth identity | Supabase auth + `EMAIL_TO_MEMBER` mapping | `S.me`, React auth state | [src/hooks/useAuth.ts](/Users/t-nab/Documents/Gamification/src/hooks/useAuth.ts) | App shell, sync, push | `member_key` is the app identity contract. |
| Personal progression (`chars[me]`) | Local `S.chars[me]`, then mirrored to `member_data.data.chars[me]` | `localStorage`, `member_data` | [src/hooks/useXP.ts](/Users/t-nab/Documents/Gamification/src/hooks/useXP.ts), onboarding, coach flows | Home, profile, leaderboard, quests | Local-first. Server copy is persistence, not live collaboration. |
| Personal quests | Local `S.quests`, then mirrored to `member_data.data.quests` | `localStorage`, `member_data` | [src/hooks/useAI.ts](/Users/t-nab/Documents/Gamification/src/hooks/useAI.ts), quest UI | Quest views, coach, profile | Hybrid because collaborative quests also project into `S.quests`. |
| Collaborative quests | Supabase `collaborative_quests` | projected into `S.quests` | [src/lib/collaborativeQuests.ts](/Users/t-nab/Documents/Gamification/src/lib/collaborativeQuests.ts), quest UI | QuestGrid, quest cards | Server-owned shared object. Local copy is a view model. |
| Activity feed | Supabase `activity_feed` | Zustand feed slice in [src/state/store.ts](/Users/t-nab/Documents/Gamification/src/state/store.ts) + local feed cache | [src/hooks/useFeedSync.ts](/Users/t-nab/Documents/Gamification/src/hooks/useFeedSync.ts), SQL triggers, local event producers | ActivityFeed, Home, coach context | Shared truth is server-side. The local feed slice is a reactive staging/cache layer, not canonical social truth. |
| Notifications | Supabase `notifications` when supported | Zustand notifications slice + `localStorage` | SQL functions/triggers, [src/lib/notificationSignals.ts](/Users/t-nab/Documents/Gamification/src/lib/notificationSignals.ts), local fallbacks | Notification panel, Home | Treat Supabase notifications as canonical shared signals. Local notifications exist for resilience. |
| Reactions | Supabase `feed_reactions` | hydrated into feed items | [src/lib/socialData.ts](/Users/t-nab/Documents/Gamification/src/lib/socialData.ts) | ActivityFeed, notifications | Structured shared truth. |
| Witnesses | Supabase `feed_witnesses` | hydrated into feed items | [src/lib/socialData.ts](/Users/t-nab/Documents/Gamification/src/lib/socialData.ts) | ActivityFeed, notifications | Structured shared truth. |
| Presence | Supabase `member_presence` | none beyond local current surface | [src/hooks/usePresenceSync.ts](/Users/t-nab/Documents/Gamification/src/hooks/usePresenceSync.ts) | Home, social pulse | Server-owned ephemeral state. |
| Reminders | `member_data.data.reminders` | `S.reminders`, `localStorage` | Calendar UI + Supabase sync | Calendar reminders edge function, Home | Personal but server-mirrored so scheduled reminders can fire. |
| Check-ins | `member_data.data.checkIns` plus feed signals | `S.checkIns` | Check-in UI | Calendar, feed, stats | Local-first data with shared social consequences. UI participation semantics should be derived through [src/lib/calendarState.ts](/Users/t-nab/Documents/Gamification/src/lib/calendarState.ts), not redefined per view. |
| Coach context and policy | Local derived coach domain in [src/lib/coach](/Users/t-nab/Documents/Gamification/src/lib/coach) | localStorage-backed cadence/runtime markers + derived context | [src/lib/coach/coachContext.ts](/Users/t-nab/Documents/Gamification/src/lib/coach/coachContext.ts), [src/lib/coach/coachPolicy.ts](/Users/t-nab/Documents/Gamification/src/lib/coach/coachPolicy.ts), [src/hooks/usePresenceSync.ts](/Users/t-nab/Documents/Gamification/src/hooks/usePresenceSync.ts) | [src/hooks/useAI.ts](/Users/t-nab/Documents/Gamification/src/hooks/useAI.ts), coach UI, Home | Coach behavior is now bounded locally before AI is called. It is still local-first and not a shared durable domain. |
| Coach text and coach cache | Local character fields in `S.chars[me]` | `localStorage`, `member_data` | [src/hooks/useAI.ts](/Users/t-nab/Documents/Gamification/src/hooks/useAI.ts) | Home, coach UI, quests | Cached locally to avoid AI dependence for every render. |
| Calendar events | Google Calendar API | transient component state | [src/lib/googleCalendar.ts](/Users/t-nab/Documents/Gamification/src/lib/googleCalendar.ts) | Home, Band Hub, CalendarView | External integration, read-only in current app model. |
| Drive files | Google Drive service-account proxy | transient component state | [api/drive.ts](/Users/t-nab/Documents/Gamification/api/drive.ts) | Band Hub | External integration, server-mediated. |
| Push subscriptions | Supabase `push_subscriptions` | browser service worker registration | [src/lib/webPush.ts](/Users/t-nab/Documents/Gamification/src/lib/webPush.ts) | Edge push function | Server-owned registry of devices. |
| Baseline telemetry | device-local storage via [src/lib/productBaseline.ts](/Users/t-nab/Documents/Gamification/src/lib/productBaseline.ts) | none | app shell, social notification bootstrap | strategy review, manual diagnostics | Indicative only. Not product truth, not a shared business object. |

## Architectural Rules

These rules are the intended guardrails until the system is refactored more deeply.

1. Shared social state must be treated as server-owned.
2. Personal progression may remain local-first, but the write path must be explicit.
3. The Zustand feed slice must never again be treated as the canonical shared feed.
4. `member_data.data` is a persistence envelope, not a substitute relational model.
5. New shared interaction features should prefer structured tables over JSON blobs.
6. The UI may cache and stage, but it should not invent alternative shared truths.

## Decision Rule For New Data

When a new data object or write path is introduced, classify it before implementation:

1. If it affects only the owning member's experience, it is local-first.
2. If another member needs to see it in order to react or act, it is server-first.
3. If it must be both, the write order and conflict handling must be documented before the feature is considered ready.

This rule is stricter than taste. It exists to stop new hybrid ambiguity from creeping in silently.

## Control Flows

### App startup

1. Auth resolves a Supabase user and maps email to `member_key`.
2. `S.me` is set locally.
3. Local shell renders as soon as auth is good enough.
4. Background bootstrap runs:
   - sync from `member_data`
   - social notifications bootstrap
   - feed sync bootstrap
   - presence sync
   - push registration

Relevant files:

- [src/hooks/useAuth.ts](/Users/t-nab/Documents/Gamification/src/hooks/useAuth.ts)
- [src/hooks/useSupabaseSync.ts](/Users/t-nab/Documents/Gamification/src/hooks/useSupabaseSync.ts)
- [src/hooks/useFeedSync.ts](/Users/t-nab/Documents/Gamification/src/hooks/useFeedSync.ts)
- [src/hooks/useSocialNotifications.ts](/Users/t-nab/Documents/Gamification/src/hooks/useSocialNotifications.ts)

### Personal quest completion

1. UI requests completion.
2. XP logic computes result and mutates `S.chars[me]`.
3. Local quest state updates.
4. Local save persists to `localStorage`.
5. Debounced Supabase sync mirrors personal state to `member_data`.
6. Shared social consequences are emitted separately through feed/notifications.

Relevant files:

- [src/components/game/QuestCard.tsx](/Users/t-nab/Documents/Gamification/src/components/game/QuestCard.tsx)
- [src/hooks/useXP.ts](/Users/t-nab/Documents/Gamification/src/hooks/useXP.ts)
- [src/state/store.ts](/Users/t-nab/Documents/Gamification/src/state/store.ts)

### Social interaction

1. Client creates a shared signal or writes to a structured social table.
2. Supabase triggers/functions create or update notifications and projections.
3. Clients hydrate and subscribe to shared state.

Relevant files:

- [src/lib/socialData.ts](/Users/t-nab/Documents/Gamification/src/lib/socialData.ts)
- [src/lib/notificationSignals.ts](/Users/t-nab/Documents/Gamification/src/lib/notificationSignals.ts)
- [supabase/schema.sql](/Users/t-nab/Documents/Gamification/supabase/schema.sql)

## Known Tensions

### 1. Local-first progression vs server-owned sociality

This is the main architectural tension. It is acceptable for now, but only if we keep the boundary explicit.

### 2. Blob persistence vs relational shared state

`member_data.data` is practical for a small internal system, but its convenience hides write contracts and conflict semantics.

### 3. Compatibility layers vs architectural cleanliness

Fallback logic in `socialData.ts` improves resilience, but each fallback is also production code that must be understood and maintained.

### 4. Coach importance vs coach formalization

The coach is central to product value. It now has a bounded local domain for context, policy, and prompt construction, but still lacks durable shared memory and should not silently become a server-owned domain without an explicit decision.

## Invariants

These are the invariants that should stay true unless an intentional migration changes them.

- `member_key` is the single app identity.
- Shared notifications should prefer the `notifications` table over local-only notifications.
- Shared feed state should prefer `activity_feed` over the local feed slice.
- Reactions and witnesses should prefer structured tables over embedded feed JSON as authoring surfaces.
- `member_presence` is ephemeral and must not be treated as business history.
- Calendar reminders must exist in server-readable state if scheduled push depends on them.

## When To Revisit The Architecture

Revisit the current hybrid model if any of these become true:

- more than one device per member becomes common
- social bugs require tracing through more than three layers on a regular basis
- new shared features increasingly need cross-member transactions
- the coach starts needing durable shared context or explicit memory beyond the local coach domain
- schema drift between repo and live becomes recurring again

These are stronger triggers than a raw user-count threshold.

## Schema Discipline

Every schema-affecting change should leave evidence in three places:

1. a migration file in `supabase/migrations`
2. the canonical schema in [supabase/schema.sql](/Users/t-nab/Documents/Gamification/supabase/schema.sql)
3. a short note in documentation if the change affects system boundaries

Manual SQL-only changes without repo alignment are considered architecture debt.

## Integration Layer

These integrations are architecture, not accessories:

- Claude / AI proxy: [api/claude.js](/Users/t-nab/Documents/Gamification/api/claude.js)
- Google Drive proxy: [api/drive.ts](/Users/t-nab/Documents/Gamification/api/drive.ts)
- Google Calendar client: [src/lib/googleCalendar.ts](/Users/t-nab/Documents/Gamification/src/lib/googleCalendar.ts)
- Push registration: [src/lib/webPush.ts](/Users/t-nab/Documents/Gamification/src/lib/webPush.ts)

Each of these can fail independently of the core app and should be reasoned about as first-class boundaries.

## Current Technical Direction

Short term:

- make write ownership and state boundaries explicit
- reduce shell sprawl without changing product behavior
- keep server-owned social state stable

Medium term:

- extract explicit domain APIs for quests, progression, and social signaling
- reduce heuristics in feed semantics
- extend the coach domain deliberately without turning it into an implicit shared truth

Long term:

- decide deliberately whether hybrid remains good enough or whether shared behavior justifies stronger server ownership
