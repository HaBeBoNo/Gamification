import { S } from '../state/store';
import type { FeedEntry } from '../types/game';

function buildFeedSyncId(): string {
  return `feed_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTimestamp(ts?: string): string {
  if (!ts) return new Date().toISOString();
  const parsed = new Date(ts);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export function createFeedEntry(
  entry: Pick<FeedEntry, 'action'> & Partial<FeedEntry>
): FeedEntry {
  return {
    who: entry.who || S.me || 'system',
    action: entry.action,
    xp: entry.xp ?? 0,
    ts: normalizeTimestamp(entry.ts ?? entry.time),
    syncId: entry.syncId || buildFeedSyncId(),
    type: entry.type,
    time: undefined,
  };
}

export function pushFeedEntry(
  entry: Pick<FeedEntry, 'action'> & Partial<FeedEntry>
): FeedEntry {
  const normalized = createFeedEntry(entry);
  S.feed = S.feed || [];

  if (!S.feed.some(item => item.syncId === normalized.syncId)) {
    S.feed.unshift(normalized);
    if (S.feed.length > 50) S.feed.length = 50;
  }

  return normalized;
}
