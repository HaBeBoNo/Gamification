import { S } from '../state/store';
import type { FeedEntry } from '../types/game';
import { MEMBERS } from '../data/members';

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

export function getFeedMemberName(memberKey?: string): string {
  if (!memberKey) return 'Någon';
  return (MEMBERS as Record<string, { name?: string }>)[memberKey]?.name || memberKey;
}

function getFeedMemberKeyByName(name?: string): string | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  const entry = Object.entries(MEMBERS).find(([, member]) => member.name?.toLowerCase() === normalized);
  return entry?.[0] || null;
}

export interface ParsedFeedCommentAction {
  targetName: string;
  targetKey: string | null;
  contextLabel: string;
  comment: string;
}

export function parseFeedCommentAction(action?: string): ParsedFeedCommentAction | null {
  if (!action || !action.startsWith('kommenterade ')) return null;

  const targetEntry = Object.values(MEMBERS)
    .map((member: any) => member?.name)
    .filter(Boolean)
    .sort((a: any, b: any) => String(b).length - String(a).length)
    .find((name: any) => action.startsWith(`kommenterade ${name}s `));

  if (!targetEntry) return null;

  const remainder = action.slice(`kommenterade ${targetEntry}s `.length);
  const match = remainder.match(/^(aktivitet|"([^"]+)"):\s*"([^"]+)"$/);
  if (!match) return null;

  return {
    targetName: String(targetEntry),
    targetKey: getFeedMemberKeyByName(String(targetEntry)),
    contextLabel: match[2] || 'aktivitet',
    comment: match[3] || '',
  };
}

export function getFeedContextLabel(item: { action?: string } | null | undefined): string {
  if (!item?.action) return 'aktivitet';
  const quoted = item.action.match(/[""]([^""]+)[""]/);
  return quoted?.[1] || 'aktivitet';
}
