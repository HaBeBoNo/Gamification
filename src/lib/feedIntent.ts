import { getFeedContextLabel, parseFeedCommentAction } from '@/lib/feed';

export interface FeedIntent {
  id: string;
  mode: 'focus' | 'reply';
  feedItemId?: string;
  ownerKey?: string;
  contextLabel?: string;
  draft?: string;
  createdAt: number;
}

type FeedIntentListener = (intent: FeedIntent | null) => void;

let currentFeedIntent: FeedIntent | null = null;
const listeners = new Set<FeedIntentListener>();

function notifyListeners() {
  listeners.forEach((listener) => listener(currentFeedIntent));
}

export function setFeedIntent(intent: Omit<FeedIntent, 'id' | 'createdAt'>): FeedIntent {
  currentFeedIntent = {
    ...intent,
    id: `feed-intent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  notifyListeners();
  return currentFeedIntent;
}

export function getFeedIntent(): FeedIntent | null {
  return currentFeedIntent;
}

export function clearFeedIntent() {
  currentFeedIntent = null;
  notifyListeners();
}

export function subscribeFeedIntent(listener: FeedIntentListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isFreshFeedIntent(intent: FeedIntent | null, maxAgeMs = 30_000): boolean {
  if (!intent) return false;
  return Date.now() - intent.createdAt <= maxAgeMs;
}

export function resolveFeedIntentItem(intent: FeedIntent, feedItems: any[]): any | null {
  if (intent.feedItemId) {
    return feedItems.find((item) => String(item.id || '') === String(intent.feedItemId)) || null;
  }

  if (!intent.ownerKey) return null;

  return feedItems.find((item) => {
    if (parseFeedCommentAction(item?.action)) return false;
    if ((item.who || item.memberKey || item.member_key || '') !== intent.ownerKey) return false;

    if (!intent.contextLabel || intent.contextLabel === 'aktivitet') return true;
    return getFeedContextLabel(item) === intent.contextLabel;
  }) || null;
}
