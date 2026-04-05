#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER || 'HaBeBoNo';
const repo = process.env.GITHUB_REPO || 'Gamification';

if (!token) {
  console.error('Missing GITHUB_TOKEN.');
  console.error('Usage: GITHUB_TOKEN=... node scripts/create_sprint1_github_issues.mjs');
  process.exit(1);
}

const placeholderTokens = new Set([
  'DIN_GITHUB_TOKEN',
  'YOUR_GITHUB_TOKEN',
  'your_github_token',
  'your_token_here',
  'TOKEN_HERE',
]);

if (placeholderTokens.has(token)) {
  console.error('GITHUB_TOKEN still contains a placeholder value.');
  console.error('Create a real GitHub personal access token and export it before running the script.');
  console.error('Recommended: a fine-grained token with Issues: Read and write and Metadata: Read-only for this repository.');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'codex-sprint1-bootstrap',
};

const milestoneTitle = 'Sprint 1: Social Momentum & Coach Core';
const milestoneDescription =
  'Make the app worth logging into every day by stabilizing the core loop, strengthening lightweight member interaction, and deepening the AI coach.';

const labels = [
  { name: 'sprint-1', color: '1d76db', description: 'Sprint 1 planning and execution' },
  { name: 'high-priority', color: 'b60205', description: 'High-leverage work to do first' },
  { name: 'core-loop', color: 'd93f0b', description: 'Quest, XP, feed, and completion loop' },
  { name: 'social', color: '0e8a16', description: 'Member interaction and engagement' },
  { name: 'ai-coach', color: '5319e7', description: 'AI coach behavior and coaching UX' },
  { name: 'supabase', color: '006b75', description: 'Supabase data model and sync' },
  { name: 'ux', color: 'fbca04', description: 'User experience improvements' },
  { name: 'testing', color: 'c2e0c6', description: 'Automated test coverage and regression protection' },
  { name: 'tech-debt', color: '7057ff', description: 'Maintainability and architecture cleanup' },
  { name: 'feature', color: 'a2eeef', description: 'User-facing capability' },
  { name: 'bug', color: 'd73a4a', description: 'Broken or inconsistent behavior' },
];

const issues = [
  {
    title: 'Fix core quest/XP/feed loop consistency',
    labels: ['sprint-1', 'high-priority', 'core-loop', 'bug'],
    body: `
## Why
The main gameplay loop must be trusted before we add more social and coach behavior. Right now there are signs of inconsistent XP calculation, recurring quest handling, and feed writes.

## Scope
- Make quest completion use one authoritative XP path.
- Remove double-scaling risks between UI and XP engine.
- Make recurring quests behave intentionally instead of being removed like one-off quests.
- Ensure feed items created by completions have a consistent schema.

## Acceptance Criteria
- Completing a normal quest awards XP exactly once.
- Completing a collaborative quest does not multiply XP incorrectly.
- Daily and weekly quests are not accidentally deleted after completion.
- Feed entries from quest completion use one timestamp convention and one shape.

## Primary Files
- \`src/components/game/QuestCard.tsx\`
- \`src/hooks/useXP.ts\`
- \`src/types/game.ts\`
`.trim(),
  },
  {
    title: 'Repair Supabase feed sync and deduplication',
    labels: ['sprint-1', 'high-priority', 'supabase', 'bug'],
    body: `
## Why
The social layer depends on a stable activity feed. If feed items duplicate, arrive out of order, or disappear, motivation drops fast.

## Scope
- Replace the current array-length sync assumption with a safer event sync model.
- Prevent duplicate inserts on app start or after refresh.
- Make feed inserts idempotent or explicitly deduplicated.
- Verify activity timestamps are stored and read consistently.

## Acceptance Criteria
- Reloading the app does not create duplicate activity rows.
- New feed events appear once in Supabase and once in UI.
- Feed ordering is stable after refresh.
- Local feed state and Supabase feed stay aligned in normal use.

## Primary Files
- \`src/hooks/useFeedSync.ts\`
- \`src/components/game/ActivityFeed.tsx\`
- \`src/hooks/useSupabaseSync.ts\`
`.trim(),
  },
  {
    title: 'Add lightweight social interactions to the activity feed',
    labels: ['sprint-1', 'social', 'feature', 'ux'],
    body: `
## Why
Before full chat, the fastest motivation win is lightweight interaction. Members should be able to acknowledge each other in seconds.

## Scope
- Keep reactions and make them feel first-class.
- Add high-five support from feed items.
- Add one-line comments or short replies on key activity items.
- Add a simple "seen by" or "witnessed" mechanic for notable activity.

## Acceptance Criteria
- A member can react to a feed item in one tap.
- A member can send a high-five from the feed.
- A member can add a short comment to a completed quest or activity item.
- The owner of the activity can see that others reacted.

## Primary Files
- \`src/components/game/ActivityFeed.tsx\`
- \`src/state/notifications.ts\`
- \`src/lib/sendPush.ts\`
`.trim(),
  },
  {
    title: 'Upgrade the home screen into a login magnet',
    labels: ['sprint-1', 'ux', 'social', 'feature'],
    body: `
## Why
The home screen should instantly answer three questions: what happened, what matters, and what should I do next.

## Scope
- Add a "since you were last here" block.
- Highlight teammate activity and momentum.
- Show one recommended next quest.
- Surface pending social interactions, especially reactions/comments on your activity.

## Acceptance Criteria
- Home screen shows recent group activity in a more explicit way.
- Home screen shows one clear next action for the logged-in member.
- Home screen surfaces if someone reacted to or commented on your work.
- The page is still fast and readable on mobile.

## Primary Files
- \`src/components/game/HomeScreen.tsx\`
- \`src/components/game/ActivityFeed.tsx\`
`.trim(),
  },
  {
    title: 'Add daily AI coach nudge with a clear next action',
    labels: ['sprint-1', 'ai-coach', 'feature', 'high-priority'],
    body: `
## Why
The coach is the app's foundation. It should not only chat; it should actively orient the member each day.

## Scope
- Generate one daily coach nudge per member.
- Make the nudge concrete and tied to the current state.
- Include one suggested next action, not just reflection.
- Cache the daily message in a controlled way.

## Acceptance Criteria
- Each member sees a daily coach message that feels personal.
- The message suggests one clear next step.
- The coach message can be opened into deeper coach context.
- The message does not regenerate noisily on every render.

## Primary Files
- \`src/hooks/useAI.ts\`
- \`src/components/game/QuestGrid.tsx\`
- \`src/components/game/HomeScreen.tsx\`
`.trim(),
  },
  {
    title: 'Strengthen collaborative quests and "waiting on you" signals',
    labels: ['sprint-1', 'social', 'feature', 'supabase'],
    body: `
## Why
Collaborative quests are one of the strongest reasons to return. They turn the app into shared momentum instead of solo tracking.

## Scope
- Improve collaborative quest progress visibility.
- Add clear status like "2 of 3 done" and "X is waiting on you".
- Ensure join/complete state is synced reliably through Supabase.
- Push notable collaborative updates into the activity feed.

## Acceptance Criteria
- Collaborative quest cards clearly show progress and remaining members.
- A member can tell when their input is blocking completion.
- Join and completion state remain correct after refresh.
- Collaborative updates show up in the feed in a social way.

## Primary Files
- \`src/lib/collaborativeQuests.ts\`
- \`src/components/game/CollaborativeQuestCard.tsx\`
- \`src/components/game/QuestCard.tsx\`
`.trim(),
  },
  {
    title: 'Version the real Supabase schema used by the app',
    labels: ['sprint-1', 'supabase', 'tech-debt'],
    body: `
## Why
A large part of the backend has been created manually in Supabase SQL editor. That works short-term, but it makes future debugging and iteration much harder.

## Scope
- Export and commit the actual SQL schema for all tables currently in use.
- Include RLS policies, indexes, and triggers if they exist.
- Cover at least \`activity_feed\`, \`push_subscriptions\`, and \`collaborative_quests\`.
- Add a short note about what is source-of-truth and what is legacy.

## Acceptance Criteria
- The repo reflects the actual tables the app depends on.
- A new setup would not miss critical backend tables.
- RLS policies are documented for the active tables.
- Backend structure is understandable without memory of ad-hoc SQL pastes.

## Primary Files
- \`supabase/schema.sql\`
- \`supabase/\`
`.trim(),
  },
  {
    title: 'Add regression tests for XP, feed, social loop, and collaborative flow',
    labels: ['sprint-1', 'testing', 'tech-debt'],
    body: `
## Why
Current tests are too narrow and partly out of sync with implementation. Sprint 1 needs a small but trustworthy safety net around the loop we care most about.

## Scope
- Update XP tests to reflect the current API.
- Add tests for manual quest completion and AI-driven completion.
- Add tests for feed creation and dedup assumptions.
- Add tests for collaborative quest progress and completion.

## Acceptance Criteria
- Existing broken XP tests are rewritten or replaced to match real behavior.
- Core completion paths have passing automated coverage.
- Feed sync behavior has at least one targeted regression test.
- Collaborative quest flow has at least one happy-path test.

## Primary Files
- \`src/hooks/useXP.test.js\`
- \`src/hooks/useXP.ts\`
- \`src/hooks/useAI.ts\`
- \`src/lib/collaborativeQuests.ts\`
`.trim(),
  },
];

async function request(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });

  if (response.status === 204) return null;

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || response.statusText;
    throw new Error(`${response.status} ${message}`);
  }

  return data;
}

async function ensureLabel(label) {
  try {
    await request(`/repos/${owner}/${repo}/labels`, {
      method: 'POST',
      body: JSON.stringify(label),
    });
    console.log(`Created label: ${label.name}`);
  } catch (error) {
    if (String(error).includes('422')) {
      console.log(`Label already exists: ${label.name}`);
      return;
    }
    throw error;
  }
}

async function getOrCreateMilestone() {
  const milestones = await request(`/repos/${owner}/${repo}/milestones?state=all&per_page=100`);
  const existing = milestones.find((milestone) => milestone.title === milestoneTitle);

  if (existing) {
    console.log(`Using existing milestone: ${milestoneTitle}`);
    return existing.number;
  }

  const created = await request(`/repos/${owner}/${repo}/milestones`, {
    method: 'POST',
    body: JSON.stringify({
      title: milestoneTitle,
      description: milestoneDescription,
    }),
  });

  console.log(`Created milestone: ${milestoneTitle}`);
  return created.number;
}

async function getExistingIssueTitles() {
  const openIssues = await request(`/repos/${owner}/${repo}/issues?state=open&per_page=100`);
  return new Set(
    openIssues
      .filter((issue) => !issue.pull_request)
      .map((issue) => issue.title)
  );
}

async function createIssue(issue, milestone) {
  return request(`/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title: issue.title,
      body: issue.body,
      labels: issue.labels,
      milestone,
    }),
  });
}

async function main() {
  console.log(`Bootstrapping Sprint 1 for ${owner}/${repo}`);

  for (const label of labels) {
    await ensureLabel(label);
  }

  const milestone = await getOrCreateMilestone();
  const existingTitles = await getExistingIssueTitles();

  for (const issue of issues) {
    if (existingTitles.has(issue.title)) {
      console.log(`Skipping existing issue: ${issue.title}`);
      continue;
    }

    const created = await createIssue(issue, milestone);
    console.log(`Created issue #${created.number}: ${issue.title}`);
  }
}

main().catch((error) => {
  if (String(error.message).includes('401')) {
    console.error('GitHub rejected the token with 401 Bad credentials.');
    console.error('Make sure GITHUB_TOKEN is a real personal access token, not a placeholder, and that it has access to this repository.');
    console.error('Recommended fine-grained permissions: Issues = Read and write, Metadata = Read-only.');
    process.exit(1);
  }

  console.error(error.message);
  process.exit(1);
});
