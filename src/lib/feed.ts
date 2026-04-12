import { S, useGameStore } from '../state/store';
import type { FeedEntry } from '../types/game';
import { MEMBERS } from '../data/members';

const COMMENT_PAYLOAD_MARKER = '__sek_comment__:';

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
  const { feed, appendFeedEntry } = useGameStore.getState();

  if (!feed.some(item => item.syncId === normalized.syncId)) {
    appendFeedEntry(normalized);
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

function getPossessiveLabel(name: string): string {
  return /[sxz]$/i.test(name) ? `${name}'` : `${name}s`;
}

function getCommentActionPrefixes(name: string): string[] {
  const prefixes = [
    `kommenterade ${getPossessiveLabel(name)} `,
    `kommenterade ${name} `,
  ];

  // Backward compatibility for older generated strings like "Hanness".
  if (/[sxz]$/i.test(name)) {
    prefixes.push(`kommenterade ${name}s `);
  }

  return prefixes;
}

export interface ParsedFeedCommentAction {
  targetName: string;
  targetKey: string | null;
  contextLabel: string;
  comment: string;
  parentFeedItemId?: string | null;
}

type FeedCommentSource = {
  action?: string;
  interaction_type?: string | null;
  parent_feed_item_id?: string | null;
  context_label?: string | null;
  comment_body?: string | null;
  target_member_key?: string | null;
  metadata?: Record<string, unknown> | null;
};

interface FeedCommentActionInput {
  targetName: string;
  contextLabel: string;
  comment: string;
  parentFeedItemId?: string | null;
}

function encodeCommentPayload(payload: FeedCommentActionInput): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeCommentPayload(encoded: string): FeedCommentActionInput | null {
  try {
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as FeedCommentActionInput;
  } catch {
    return null;
  }
}

export function createFeedCommentAction({
  targetName,
  contextLabel,
  comment,
  parentFeedItemId,
}: FeedCommentActionInput): string {
  const labelPart = contextLabel === 'aktivitet' ? 'aktivitet' : `"${contextLabel}"`;
  const payload = encodeCommentPayload({
    targetName,
    contextLabel,
    comment,
    parentFeedItemId: parentFeedItemId || null,
  });

  return `kommenterade ${getPossessiveLabel(targetName)} ${labelPart}: ${COMMENT_PAYLOAD_MARKER}${payload}`;
}

export function getCommentActionTargetName(params: {
  ownerName?: string | null;
  replyTargetName?: string | null;
}): string {
  return params.replyTargetName?.trim() || params.ownerName?.trim() || 'Någon';
}

export function getCommentNotificationTargets(params: {
  actorKey?: string | null;
  ownerKey?: string | null;
  replyTargetKey?: string | null;
}): string[] {
  const targets = [params.ownerKey, params.replyTargetKey]
    .filter((memberKey): memberKey is string => Boolean(memberKey))
    .filter((memberKey) => memberKey !== params.actorKey);

  return [...new Set(targets)];
}

export function parseFeedCommentAction(action?: string): ParsedFeedCommentAction | null {
  if (!action || !action.startsWith('kommenterade ')) return null;

  const targetEntry = Object.values(MEMBERS)
    .map((member: any) => member?.name)
    .filter(Boolean)
    .sort((a: any, b: any) => String(b).length - String(a).length)
    .find((name: any) => getCommentActionPrefixes(String(name)).some((prefix) => action.startsWith(prefix)));

  if (!targetEntry) return null;

  const matchedPrefix = getCommentActionPrefixes(String(targetEntry))
    .find((prefix) => action.startsWith(prefix));
  if (!matchedPrefix) return null;

  const remainder = action.slice(matchedPrefix.length);
  const markerIndex = remainder.indexOf(COMMENT_PAYLOAD_MARKER);
  if (markerIndex >= 0) {
    const encodedPayload = remainder.slice(markerIndex + COMMENT_PAYLOAD_MARKER.length).trim();
    const decoded = decodeCommentPayload(encodedPayload);
    if (decoded?.comment) {
      return {
        targetName: String(targetEntry),
        targetKey: getFeedMemberKeyByName(String(targetEntry)),
        contextLabel: decoded.contextLabel || 'aktivitet',
        comment: decoded.comment,
        parentFeedItemId: decoded.parentFeedItemId || null,
      };
    }
  }

  const match = remainder.match(/^(aktivitet|"([^"]+)"):\s*"([^"]+)"$/);
  if (!match) return null;

  return {
    targetName: String(targetEntry),
    targetKey: getFeedMemberKeyByName(String(targetEntry)),
    contextLabel: match[2] || 'aktivitet',
    comment: match[3] || '',
    parentFeedItemId: null,
  };
}

function structuredTargetName(item: FeedCommentSource): string {
  const targetMemberKey = item.target_member_key || '';
  if (targetMemberKey) return getFeedMemberName(targetMemberKey);

  const metadataTargetName = item.metadata?.targetMemberName;
  return typeof metadataTargetName === 'string' && metadataTargetName
    ? metadataTargetName
    : 'Någon';
}

export function getFeedCommentMeta(item?: FeedCommentSource | null): ParsedFeedCommentAction | null {
  if (!item) return null;

  if (item.interaction_type === 'comment' || item.comment_body || item.parent_feed_item_id || item.target_member_key) {
    return {
      targetName: structuredTargetName(item),
      targetKey: item.target_member_key || null,
      contextLabel: item.context_label || 'aktivitet',
      comment: item.comment_body || '',
      parentFeedItemId: item.parent_feed_item_id || null,
    };
  }

  return parseFeedCommentAction(item.action);
}

export function getFeedContextLabel(item: { action?: string } | null | undefined): string {
  if (!item) return 'aktivitet';
  const structuredLabel = (item as FeedCommentSource).context_label;
  if (structuredLabel) return structuredLabel;
  if (!item.action) return 'aktivitet';
  const parsedComment = getFeedCommentMeta(item as FeedCommentSource);
  if (parsedComment) return parsedComment.contextLabel;
  const quoted = item.action.match(/[""]([^""]+)[""]/);
  return quoted?.[1] || 'aktivitet';
}
