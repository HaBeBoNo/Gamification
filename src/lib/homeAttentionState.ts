import type { HomeAttentionSignal } from '@/lib/homeSurface';

const HOME_ATTENTION_SEEN_PREFIX = 'sek-home-attention-seen:';

const currentSignalIdsByMember = new Map<string, string[]>();

function loadSeenIds(memberKey: string): string[] {
  if (typeof window === 'undefined' || !memberKey) return [];

  try {
    const raw = window.localStorage.getItem(`${HOME_ATTENTION_SEEN_PREFIX}${memberKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string' && value.length > 0) : [];
  } catch {
    return [];
  }
}

function saveSeenIds(memberKey: string, ids: string[]): void {
  if (typeof window === 'undefined' || !memberKey) return;

  try {
    window.localStorage.setItem(
      `${HOME_ATTENTION_SEEN_PREFIX}${memberKey}`,
      JSON.stringify([...new Set(ids)].slice(-100)),
    );
  } catch {
    // Ignore storage failures; attention still works in-session.
  }
}

export function cacheCurrentHomeAttentionSignals(memberKey: string, signals: HomeAttentionSignal[]): void {
  if (!memberKey) return;
  currentSignalIdsByMember.set(memberKey, signals.map((signal) => signal.id));
}

export function filterSeenHomeAttentionSignals(memberKey: string, signals: HomeAttentionSignal[]): HomeAttentionSignal[] {
  if (!memberKey) return signals;
  const seenIds = new Set(loadSeenIds(memberKey));
  return signals.filter((signal) => !seenIds.has(signal.id));
}

export function markHomeAttentionSeen(memberKey: string, signalIds: string[]): void {
  if (!memberKey || signalIds.length === 0) return;
  const seenIds = [...loadSeenIds(memberKey), ...signalIds];
  saveSeenIds(memberKey, seenIds);
}

export function markCurrentHomeAttentionSeen(memberKey: string): void {
  if (!memberKey) return;
  markHomeAttentionSeen(memberKey, currentSignalIdsByMember.get(memberKey) || []);
}

export function clearHomeAttentionSeen(memberKey: string): void {
  if (typeof window === 'undefined' || !memberKey) return;

  currentSignalIdsByMember.delete(memberKey);

  try {
    window.localStorage.removeItem(`${HOME_ATTENTION_SEEN_PREFIX}${memberKey}`);
  } catch {
    // Ignore storage cleanup failures.
  }
}
