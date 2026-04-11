import { S, useGameStore } from '@/state/store';
import { isQuestDoneNow } from '@/lib/questUtils';
import type { ReengagementStage } from '@/lib/reengagement';
import type { FeedEntry, Notification } from '@/types/game';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_FLOW_WINDOW_MS = 5 * 60 * 1000;
const INITIATION_STORAGE_KEY = 'hq_coach_policy_initiations_v1';
const SURFACE_STORAGE_KEY = 'hq_coach_policy_surface_v1';

type SurfaceActivity = {
  surface: string;
  ts: number;
};

type CoachInitiationRegistry = Record<string, number>;
type CoachSurfaceRegistry = Record<string, SurfaceActivity>;

export type CoachPolicyEvent =
  | { kind: 'quest'; status?: 'completed' | 'started'; questType?: string }
  | { kind: 'feed'; entry: Partial<FeedEntry> }
  | { kind: 'notification'; notification: Partial<Notification> };

const initiationMemory: CoachInitiationRegistry = {};
const surfaceMemory: CoachSurfaceRegistry = {};

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function readRegistry<T extends Record<string, any>>(key: string, fallback: T): T {
  if (!canUseLocalStorage()) return { ...fallback };

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...fallback };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? { ...fallback, ...(parsed as T) }
      : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function writeRegistry<T extends Record<string, any>>(key: string, value: T): void {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function getInitiationRegistry(): CoachInitiationRegistry {
  const registry = readRegistry(INITIATION_STORAGE_KEY, initiationMemory);
  Object.assign(initiationMemory, registry);
  return registry;
}

function getSurfaceRegistry(): CoachSurfaceRegistry {
  const registry = readRegistry(SURFACE_STORAGE_KEY, surfaceMemory);
  Object.assign(surfaceMemory, registry);
  return registry;
}

function getLastInitiatedAt(memberKey: string): number {
  return Number(getInitiationRegistry()[memberKey] || 0);
}

export function markCoachInitiated(memberKey: string, at = Date.now()): void {
  if (!memberKey) return;
  const registry = getInitiationRegistry();
  registry[memberKey] = at;
  initiationMemory[memberKey] = at;
  writeRegistry(INITIATION_STORAGE_KEY, registry);
}

export function recordSurfaceActivity(memberKey: string, surface: string, at = Date.now()): void {
  if (!memberKey || !surface) return;
  const registry = getSurfaceRegistry();
  registry[memberKey] = { surface, ts: at };
  surfaceMemory[memberKey] = { surface, ts: at };
  writeRegistry(SURFACE_STORAGE_KEY, registry);
}

export function readSurfaceActivity(memberKey: string): SurfaceActivity | null {
  if (!memberKey) return null;
  return getSurfaceRegistry()[memberKey] || null;
}

export function canInitiate(memberKey: string, now = Date.now()): boolean {
  if (!memberKey) return false;
  const lastInitiatedAt = getLastInitiatedAt(memberKey);
  if (!lastInitiatedAt) return true;
  return now - lastInitiatedAt >= DAY_MS;
}

export function shouldReactToEvent(event: CoachPolicyEvent): boolean {
  if (event.kind === 'quest') {
    return event.status === 'completed';
  }

  if (event.kind === 'notification') {
    return [
      'feed_comment',
      'feed_reaction',
      'high_five',
      'collaborative_progress',
      'collaborative_complete',
      'calendar_check_in_open',
    ].includes(String(event.notification.type || ''));
  }

  const entryType = String(event.entry.type || event.entry.interaction_type || '');
  const action = String(event.entry.action || '').toLowerCase();

  if (['level_up', 'quest_insight', 'collaborative_join'].includes(entryType)) return true;

  return (
    action.includes('completed "') ||
    action.includes('reflekterade över') ||
    action.includes('checkade in') ||
    action.includes('gav en high-five')
  );
}

export function isInActiveFlow(memberKey: string, now = Date.now()): boolean {
  if (!memberKey) return false;

  const hasOngoingQuest = (S.quests || []).some(
    (quest) => quest.owner === memberKey && !isQuestDoneNow(quest)
  );
  if (hasOngoingQuest) return true;

  const presenceMember = useGameStore
    .getState()
    .presenceMembers
    .find((member) => member.member_key === memberKey);
  const presenceLastSeenAt = presenceMember?.last_seen_at
    ? Date.parse(String(presenceMember.last_seen_at))
    : 0;

  if (
    presenceMember?.current_surface === 'bandhub' &&
    presenceMember.is_online !== false &&
    presenceLastSeenAt > 0 &&
    now - presenceLastSeenAt <= ACTIVE_FLOW_WINDOW_MS
  ) {
    return true;
  }

  const recentSurface = readSurfaceActivity(memberKey);
  if (!recentSurface) return false;

  return recentSurface.surface === 'bandhub' && now - recentSurface.ts <= ACTIVE_FLOW_WINDOW_MS;
}

export function getReengagementMode(context: { reengagementStage: ReengagementStage }): 'silent' | 'proactive' | 'summary' {
  switch (context.reengagementStage) {
    case 'quiet_3':
      return 'proactive';
    case 'quiet_7':
    case 'quiet_14':
      return 'summary';
    default:
      return 'silent';
  }
}

export const CoachPolicy = {
  canInitiate,
  shouldReactToEvent,
  isInActiveFlow,
  getReengagementMode,
  markInitiated: markCoachInitiated,
  recordSurfaceActivity,
  readSurfaceActivity,
};
