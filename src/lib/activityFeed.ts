import { MEMBERS } from '@/data/members';
import { getFeedCommentMeta, getFeedContextLabel } from '@/lib/feed';

export function timeAgo(ts: number | string): string {
  if (typeof ts === 'string') return ts;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m sedan`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h sedan`;
  return `${Math.floor(hrs / 24)}d sedan`;
}

export function formatFeedTime(ts: string | number | undefined): string {
  if (!ts) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return typeof ts === 'string' && ts.length <= 5 ? ts : '';
  }
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

export function getFeedTimestampValue(item: any): number {
  const raw = item?.created_at ?? item?.ts ?? item?.time ?? item?.t;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatRelativeActivity(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h sedan`;
  const days = Math.floor(hours / 24);
  return `${days}d sedan`;
}

export function isRecentActivity(ts: number, maxAgeMs = 24 * 60 * 60 * 1000): boolean {
  return Boolean(ts) && Date.now() - ts <= maxAgeMs;
}

export function getMemberName(memberKey?: string): string {
  if (!memberKey) return 'Någon';
  return (MEMBERS as Record<string, { name?: string }>)[memberKey]?.name || memberKey;
}

export function buildFeedPresentation(feedItems: any[]) {
  const commentsByItemId = new Map<string, Array<any>>();
  const hiddenCommentIds = new Set<string>();
  const pendingSpecific = new Map<string, Array<any>>();
  const pendingGeneric = new Map<string, Array<any>>();

  feedItems.forEach((item) => {
    const parsed = getFeedCommentMeta(item);
    const itemId = String(item.id || '');

    if (parsed) {
      const enriched = { ...item, parsedComment: parsed };
      if (parsed.parentFeedItemId) {
        const list = commentsByItemId.get(parsed.parentFeedItemId) || [];
        list.push(enriched);
        commentsByItemId.set(parsed.parentFeedItemId, list);
        if (itemId) hiddenCommentIds.add(itemId);
        return;
      }

      if (parsed.contextLabel === 'aktivitet') {
        const list = pendingGeneric.get(parsed.targetKey || parsed.targetName) || [];
        list.push(enriched);
        pendingGeneric.set(parsed.targetKey || parsed.targetName, list);
      } else {
        const key = `${parsed.targetKey || parsed.targetName}|${parsed.contextLabel}`;
        const list = pendingSpecific.get(key) || [];
        list.push(enriched);
        pendingSpecific.set(key, list);
      }
      return;
    }

    const ownerKey = item.who || item.memberKey || item.member_key || '';
    const contextLabel = getFeedContextLabel(item);
    const specificKey = `${ownerKey}|${contextLabel}`;
    const attachedSpecific = pendingSpecific.get(specificKey) || [];
    const attachedGeneric = pendingGeneric.get(ownerKey) || [];
    const attached = [...attachedSpecific, ...attachedGeneric];

    if (attached.length > 0 && itemId) {
      commentsByItemId.set(itemId, attached);
      attached.forEach((commentItem) => hiddenCommentIds.add(String(commentItem.id || '')));
    }

    pendingSpecific.delete(specificKey);
    pendingGeneric.delete(ownerKey);
  });

  return { commentsByItemId, hiddenCommentIds };
}

export function extractXPFromText(text: string): number | null {
  const match = text.match(/\(\+(\d+)\s*XP/i);
  return match ? parseInt(match[1], 10) : null;
}

export type ReplyTarget = {
  memberKey?: string;
  memberName: string;
  commentId?: string;
};

export function getReplyPrefix(replyTarget?: ReplyTarget | null): string {
  if (!replyTarget?.memberName) return '';
  return `@${replyTarget.memberName.split(' ')[0]} `;
}

export function isCommentReady(rawDraft: string, replyTarget?: ReplyTarget | null): boolean {
  const trimmed = rawDraft.trim();
  if (!trimmed) return false;

  const replyPrefix = getReplyPrefix(replyTarget).trim();
  if (replyPrefix && trimmed === replyPrefix) return false;

  return true;
}

export function sortFeedItemsByTimeAsc(items: any[]): any[] {
  return [...items].sort((left, right) => getFeedTimestampValue(left) - getFeedTimestampValue(right));
}

export function sanitizeReactionDraft(rawDraft: string): string {
  const trimmed = rawDraft.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] || '';
}

export function isSameIncomingFeedItem(existing: any, incoming: any) {
  if (existing?.id && incoming?.id && String(existing.id) === String(incoming.id)) {
    return true;
  }

  const existingComment = getFeedCommentMeta(existing);
  const incomingComment = getFeedCommentMeta(incoming);
  const timestampDelta = Math.abs(getFeedTimestampValue(existing) - getFeedTimestampValue(incoming));

  if (existingComment && incomingComment) {
    return (
      existing?.who === incoming?.who &&
      existingComment.parentFeedItemId === incomingComment.parentFeedItemId &&
      existingComment.comment === incomingComment.comment &&
      timestampDelta < 5000
    );
  }

  return (
    existing?.who === incoming?.who &&
    existing?.action === incoming?.action &&
    Number(existing?.xp || 0) === Number(incoming?.xp || 0) &&
    timestampDelta < 5000
  );
}

export function mergeIncomingFeedItem(prev: any[], incoming: any) {
  return [incoming, ...prev.filter((item) => !isSameIncomingFeedItem(item, incoming))].slice(0, 50);
}
