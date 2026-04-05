# Sprint 1: Social Momentum & Coach Core

## Sprint Goal
Make the app feel worth logging into every day by strengthening three things:

1. The core quest/XP/feed loop is reliable.
2. Members can react to each other quickly and often.
3. The AI coach gives a meaningful next step.

## What Not To Build In This Sprint

- Full chat
- Large state refactor
- Multi-tenant support for other bands/federations

## Recommended Issue Order

1. Fix core quest/XP/feed loop consistency
2. Repair Supabase feed sync and deduplication
3. Add lightweight social interactions to the activity feed
4. Upgrade the home screen into a login magnet
5. Add daily AI coach nudge with a clear next action
6. Strengthen collaborative quests and "waiting on you" signals
7. Version the real Supabase schema used by the app
8. Add regression tests for the core social loop

## Suggested Labels

- `sprint-1`
- `high-priority`
- `core-loop`
- `social`
- `ai-coach`
- `supabase`
- `ux`
- `testing`
- `tech-debt`
- `feature`
- `bug`

## GitHub Issues

### 1. Fix core quest/XP/feed loop consistency

**Labels:** `sprint-1`, `high-priority`, `core-loop`, `bug`

**Why**
The main gameplay loop must be trusted before we add more social and coach behavior. Right now there are signs of inconsistent XP calculation, recurring quest handling, and feed writes.

**Scope**
- Make quest completion use one authoritative XP path.
- Remove double-scaling risks between UI and XP engine.
- Make recurring quests behave intentionally instead of being removed like one-off quests.
- Ensure feed items created by completions have a consistent schema.

**Acceptance Criteria**
- Completing a normal quest awards XP exactly once.
- Completing a collaborative quest does not multiply XP incorrectly.
- Daily and weekly quests are not accidentally deleted after completion.
- Feed entries from quest completion use one timestamp convention and one shape.

**Primary Files**
- `src/components/game/QuestCard.tsx`
- `src/hooks/useXP.ts`
- `src/types/game.ts`

### 2. Repair Supabase feed sync and deduplication

**Labels:** `sprint-1`, `high-priority`, `supabase`, `bug`

**Why**
The social layer depends on a stable activity feed. If feed items duplicate, arrive out of order, or disappear, motivation drops fast.

**Scope**
- Replace the current array-length sync assumption with a safer event sync model.
- Prevent duplicate inserts on app start or after refresh.
- Make feed inserts idempotent or explicitly deduplicated.
- Verify activity timestamps are stored and read consistently.

**Acceptance Criteria**
- Reloading the app does not create duplicate activity rows.
- New feed events appear once in Supabase and once in UI.
- Feed ordering is stable after refresh.
- Local feed state and Supabase feed stay aligned in normal use.

**Primary Files**
- `src/hooks/useFeedSync.ts`
- `src/components/game/ActivityFeed.tsx`
- `src/hooks/useSupabaseSync.ts`

### 3. Add lightweight social interactions to the activity feed

**Labels:** `sprint-1`, `social`, `feature`, `ux`

**Why**
Before full chat, the fastest motivation win is lightweight interaction. Members should be able to acknowledge each other in seconds.

**Scope**
- Keep reactions and make them feel first-class.
- Add high-five support from feed items.
- Add one-line comments or short replies on key activity items.
- Add a simple “seen by” or “witnessed” mechanic for notable activity.

**Acceptance Criteria**
- A member can react to a feed item in one tap.
- A member can send a high-five from the feed.
- A member can add a short comment to a completed quest or activity item.
- The owner of the activity can see that others reacted.

**Primary Files**
- `src/components/game/ActivityFeed.tsx`
- `src/state/notifications.ts`
- `src/lib/sendPush.ts`

### 4. Upgrade the home screen into a login magnet

**Labels:** `sprint-1`, `ux`, `social`, `feature`

**Why**
The home screen should instantly answer three questions: what happened, what matters, and what should I do next.

**Scope**
- Add a “since you were last here” block.
- Highlight teammate activity and momentum.
- Show one recommended next quest.
- Surface pending social interactions, especially reactions/comments on your activity.

**Acceptance Criteria**
- Home screen shows recent group activity in a more explicit way.
- Home screen shows one clear next action for the logged-in member.
- Home screen surfaces if someone reacted to or commented on your work.
- The page is still fast and readable on mobile.

**Primary Files**
- `src/components/game/HomeScreen.tsx`
- `src/components/game/ActivityFeed.tsx`

### 5. Add daily AI coach nudge with a clear next action

**Labels:** `sprint-1`, `ai-coach`, `feature`, `high-priority`

**Why**
The coach is the app’s foundation. It should not only chat; it should actively orient the member each day.

**Scope**
- Generate one daily coach nudge per member.
- Make the nudge concrete and tied to the current state.
- Include one suggested next action, not just reflection.
- Cache the daily message in a controlled way.

**Acceptance Criteria**
- Each member sees a daily coach message that feels personal.
- The message suggests one clear next step.
- The coach message can be opened into deeper coach context.
- The message does not regenerate noisily on every render.

**Primary Files**
- `src/hooks/useAI.ts`
- `src/components/game/QuestGrid.tsx`
- `src/components/game/HomeScreen.tsx`

### 6. Strengthen collaborative quests and “waiting on you” signals

**Labels:** `sprint-1`, `social`, `feature`, `supabase`

**Why**
Collaborative quests are one of the strongest reasons to return. They turn the app into shared momentum instead of solo tracking.

**Scope**
- Improve collaborative quest progress visibility.
- Add clear status like “2 of 3 done” and “X is waiting on you”.
- Ensure join/complete state is synced reliably through Supabase.
- Push notable collaborative updates into the activity feed.

**Acceptance Criteria**
- Collaborative quest cards clearly show progress and remaining members.
- A member can tell when their input is blocking completion.
- Join and completion state remain correct after refresh.
- Collaborative updates show up in the feed in a social way.

**Primary Files**
- `src/lib/collaborativeQuests.ts`
- `src/components/game/CollaborativeQuestCard.tsx`
- `src/components/game/QuestCard.tsx`

### 7. Version the real Supabase schema used by the app

**Labels:** `sprint-1`, `supabase`, `tech-debt`

**Why**
A large part of the backend has been created manually in Supabase SQL editor. That works short-term, but it makes future debugging and iteration much harder.

**Scope**
- Export and commit the actual SQL schema for all tables currently in use.
- Include RLS policies, indexes, and triggers if they exist.
- Cover at least `activity_feed`, `push_subscriptions`, and `collaborative_quests`.
- Add a short note about what is source-of-truth and what is legacy.

**Acceptance Criteria**
- The repo reflects the actual tables the app depends on.
- A new setup would not miss critical backend tables.
- RLS policies are documented for the active tables.
- Backend structure is understandable without memory of ad-hoc SQL pastes.

**Primary Files**
- `supabase/schema.sql`
- `supabase/`

### 8. Add regression tests for XP, feed, social loop, and collaborative flow

**Labels:** `sprint-1`, `testing`, `tech-debt`

**Why**
Current tests are too narrow and partly out of sync with implementation. Sprint 1 needs a small but trustworthy safety net around the loop we care most about.

**Scope**
- Update XP tests to reflect the current API.
- Add tests for manual quest completion and AI-driven completion.
- Add tests for feed creation and dedup assumptions.
- Add tests for collaborative quest progress and completion.

**Acceptance Criteria**
- Existing broken XP tests are rewritten or replaced to match real behavior.
- Core completion paths have passing automated coverage.
- Feed sync behavior has at least one targeted regression test.
- Collaborative quest flow has at least one happy-path test.

**Primary Files**
- `src/hooks/useXP.test.js`
- `src/hooks/useXP.ts`
- `src/hooks/useAI.ts`
- `src/lib/collaborativeQuests.ts`

## Optional Stretch

- Add a tiny inbox card on home screen for “someone reacted to you”.
- Add a tiny coach summary after each completed quest.

## Automation

Use `scripts/create_sprint1_github_issues.mjs` to create the sprint directly in GitHub once `GITHUB_TOKEN` is available.

### Token setup

The script does not require `gh`, but it does require a real GitHub token.

Recommended option:

- Create a fine-grained personal access token for `HaBeBoNo/Gamification`
- Grant `Issues: Read and write`
- Grant `Metadata: Read-only`

Then run:

```bash
export GITHUB_TOKEN='github_pat_...'
node scripts/create_sprint1_github_issues.mjs
```
