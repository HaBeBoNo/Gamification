# Sektionen HQ — Debugging Runbook

## Goal

This runbook exists to answer one question quickly:

`Where does the truth for this bug actually live?`

Do not start from UI symptoms alone. Start by classifying the data class.

If the issue affects feed, notifications, calendar, collab, or push, add it to
[BASELINE_AND_INCIDENT_LOG.md](/Users/t-nab/Documents/Gamification/docs/BASELINE_AND_INCIDENT_LOG.md)
before or during investigation. The goal is a lightweight baseline for time-to-root-cause, not process theater.

## Step 1: Classify The Problem

Pick the narrowest category that matches the bug:

- auth / member identity
- personal progression
- quest state
- collaborative quest state
- activity feed
- notifications
- reactions / witnesses
- presence / live now
- calendar / reminders
- coach / AI
- Drive / external integration
- push delivery

## Step 2: Locate The Canonical Layer

Use this cheat sheet before reading component code:

- personal progression: [src/state/store.ts](/Users/t-nab/Documents/Gamification/src/state/store.ts), mirrored by [src/hooks/useSupabaseSync.ts](/Users/t-nab/Documents/Gamification/src/hooks/useSupabaseSync.ts)
- shared feed: `activity_feed` in [supabase/schema.sql](/Users/t-nab/Documents/Gamification/supabase/schema.sql)
- shared notifications: `notifications` in [supabase/schema.sql](/Users/t-nab/Documents/Gamification/supabase/schema.sql)
- reactions: `feed_reactions`
- witnesses: `feed_witnesses`
- presence: `member_presence`
- collaborative quests: `collaborative_quests`
- calendar events: Google Calendar API via [src/lib/googleCalendar.ts](/Users/t-nab/Documents/Gamification/src/lib/googleCalendar.ts)
- Drive files: service-account proxy via [api/drive.ts](/Users/t-nab/Documents/Gamification/api/drive.ts)

If you cannot say where the truth lives, stop and answer that first.

## Step 3: Trace By Symptom

### XP or personal quest state is wrong

Check in this order:

1. [src/hooks/useXP.ts](/Users/t-nab/Documents/Gamification/src/hooks/useXP.ts)
2. [src/components/game/QuestCard.tsx](/Users/t-nab/Documents/Gamification/src/components/game/QuestCard.tsx)
3. [src/state/store.ts](/Users/t-nab/Documents/Gamification/src/state/store.ts)
4. [src/hooks/useSupabaseSync.ts](/Users/t-nab/Documents/Gamification/src/hooks/useSupabaseSync.ts)

Questions:

- Was the mutation applied to `S`?
- Did `save()` run?
- Did the mirrored `member_data` payload include the change?
- Is the UI reading `S` or stale derived state?

### Shared feed bug

Check in this order:

1. the feed write path that produced the event
2. [src/hooks/useFeedSync.ts](/Users/t-nab/Documents/Gamification/src/hooks/useFeedSync.ts)
3. `activity_feed`
4. [src/lib/socialData.ts](/Users/t-nab/Documents/Gamification/src/lib/socialData.ts)
5. [src/components/game/ActivityFeed.tsx](/Users/t-nab/Documents/Gamification/src/components/game/ActivityFeed.tsx)

Questions:

- Was the event created locally only or actually inserted into `activity_feed`?
- Is it duplicated at write time or only in presentation?
- Is the bug in hydration, dedupe, or rendering?

### Notification missing or duplicated

Check in this order:

1. [src/lib/notificationSignals.ts](/Users/t-nab/Documents/Gamification/src/lib/notificationSignals.ts)
2. SQL notification functions/triggers in [supabase/schema.sql](/Users/t-nab/Documents/Gamification/supabase/schema.sql)
3. `notifications` table
4. [src/hooks/useSocialNotifications.ts](/Users/t-nab/Documents/Gamification/src/hooks/useSocialNotifications.ts)
5. [src/state/notifications.ts](/Users/t-nab/Documents/Gamification/src/state/notifications.ts)

Questions:

- Was the notification created server-side?
- Did dedupe collapse it unexpectedly?
- Did the client fall back to legacy mode?
- Did the UI mark it read immediately?

### Presence or “live now” bug

Check in this order:

1. [src/hooks/usePresenceSync.ts](/Users/t-nab/Documents/Gamification/src/hooks/usePresenceSync.ts)
2. `member_presence`
3. [src/lib/socialData.ts](/Users/t-nab/Documents/Gamification/src/lib/socialData.ts)
4. [src/components/game/HomeScreen.tsx](/Users/t-nab/Documents/Gamification/src/components/game/HomeScreen.tsx)

Questions:

- Is the presence row being updated?
- Is stale data being counted as live?
- Is the UI mixing local assumptions with server presence?

### Calendar reminder or calendar social signal bug

Check in this order:

1. [src/components/game/CalendarView.tsx](/Users/t-nab/Documents/Gamification/src/components/game/CalendarView.tsx)
2. [src/hooks/useSupabaseSync.ts](/Users/t-nab/Documents/Gamification/src/hooks/useSupabaseSync.ts)
3. `member_data.data.reminders`
4. calendar edge function in Supabase
5. push delivery chain

Questions:

- Was the reminder saved in server-readable state?
- Is the event time classification correct locally?
- Did the edge function have enough information to send?

### Coach or AI bug

Check in this order:

1. [src/hooks/useAI.ts](/Users/t-nab/Documents/Gamification/src/hooks/useAI.ts)
2. [src/lib/claudeApi.ts](/Users/t-nab/Documents/Gamification/src/lib/claudeApi.ts)
3. [api/claude.js](/Users/t-nab/Documents/Gamification/api/claude.js)
4. cached coach fields on `S.chars[me]`

Questions:

- Is the issue in generation, caching, or fallback?
- Is the UI showing a cached message that looks like a live one?
- Is the backend proxy failing or is the app intentionally degrading?

### Drive integration bug

Check in this order:

1. [src/lib/googleDrive.ts](/Users/t-nab/Documents/Gamification/src/lib/googleDrive.ts)
2. [api/drive.ts](/Users/t-nab/Documents/Gamification/api/drive.ts)
3. relevant env vars / service account configuration

Questions:

- Is the bug in UI upload/listing logic or in the proxy?
- Does the proxy have credentials?
- Is the Drive folder assumption still correct?

### Push delivery bug

Check in this order:

1. [src/lib/webPush.ts](/Users/t-nab/Documents/Gamification/src/lib/webPush.ts)
2. `push_subscriptions`
3. [src/lib/sendPush.ts](/Users/t-nab/Documents/Gamification/src/lib/sendPush.ts)
4. Supabase edge push function
5. service worker handling

Questions:

- Is the device registered?
- Did the push send path target the right member?
- Did the browser receive but ignore the push?

## Step 4: Distinguish Write Bugs From Read Bugs

Always decide which of these you are facing:

- write bug: the canonical data is wrong
- read bug: canonical data is right, UI or hydration is wrong
- sync bug: local and server states disagree
- dedupe bug: data is duplicated or collapsed incorrectly

This distinction saves time.

## Step 5: Minimum Evidence Before Fixing

Before editing code, collect at least:

1. the canonical row or state that is wrong
2. the code path that wrote it
3. the code path that read it
4. whether the bug is local-only, shared-only, or cross-layer

## Step 6: Post-Fix Verification

After every fix, verify at the narrowest layer first:

1. canonical data
2. hydration / sync
3. UI
4. push / realtime consequences

Do not rely on UI alone to conclude the fix is correct.
