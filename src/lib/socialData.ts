import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/game';

type SocialCapability =
  | 'notifications'
  | 'feed_reactions'
  | 'feed_witnesses'
  | 'member_presence';

type FeedReactionRow = {
  feed_item_id: string;
  member_key: string;
  emoji: string;
};

type FeedWitnessRow = {
  feed_item_id: string;
  member_key: string;
};

type RemoteNotificationRow = {
  id: string;
  member_key: string;
  actor_member_key?: string | null;
  type: string;
  title?: string | null;
  body?: string | null;
  read?: boolean | null;
  read_at?: string | null;
  payload?: Record<string, unknown> | null;
  feed_item_id?: string | null;
  created_at?: string | null;
};

type CapabilityState = Partial<Record<SocialCapability, boolean>>;

const capabilityState: CapabilityState = {};

function setCapability(capability: SocialCapability, supported: boolean) {
  capabilityState[capability] = supported;
}

function getCapability(capability: SocialCapability): boolean | null {
  return capabilityState[capability] ?? null;
}

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const parts = ['message', 'details', 'hint', 'code']
    .map((key) => String((error as Record<string, unknown>)[key] || ''))
    .filter(Boolean);
  return parts.join(' ').toLowerCase();
}

function isMissingSocialResourceError(error: unknown): boolean {
  const text = errorText(error);
  return (
    text.includes('does not exist') ||
    text.includes('could not find the table') ||
    text.includes('could not find the relation') ||
    text.includes('schema cache') ||
    text.includes('42p01') ||
    text.includes('42703') ||
    text.includes('pgrst205')
  );
}

function normalizePayload(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};
}

function mergeReactionMaps(
  left: Record<string, string[]>,
  right: Record<string, string[]>
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  const emojis = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);

  emojis.forEach((emoji) => {
    const members = [...new Set([...(left?.[emoji] || []), ...(right?.[emoji] || [])].filter(Boolean))];
    if (members.length > 0) next[emoji] = members;
  });

  return next;
}

function mapReactionRows(rows: FeedReactionRow[]): Map<string, Record<string, string[]>> {
  const byItem = new Map<string, Record<string, string[]>>();

  rows.forEach((row) => {
    const itemId = String(row.feed_item_id || '');
    if (!itemId || !row.member_key || !row.emoji) return;

    const current = byItem.get(itemId) || {};
    const members = new Set([...(current[row.emoji] || []), row.member_key]);
    current[row.emoji] = [...members];
    byItem.set(itemId, current);
  });

  return byItem;
}

function mapWitnessRows(rows: FeedWitnessRow[]): Map<string, string[]> {
  const byItem = new Map<string, string[]>();

  rows.forEach((row) => {
    const itemId = String(row.feed_item_id || '');
    if (!itemId || !row.member_key) return;
    const current = new Set(byItem.get(itemId) || []);
    current.add(row.member_key);
    byItem.set(itemId, [...current]);
  });

  return byItem;
}

export async function hydrateFeedItems<T extends Record<string, any>>(feedItems: T[]): Promise<T[]> {
  if (!supabase || feedItems.length === 0) return feedItems;

  const itemIds = [...new Set(feedItems.map((item) => String(item.id || '')).filter(Boolean))];
  if (itemIds.length === 0) return feedItems;

  const reactionsSupported = getCapability('feed_reactions') !== false;
  const witnessesSupported = getCapability('feed_witnesses') !== false;

  const [reactionsResult, witnessesResult] = await Promise.all([
    reactionsSupported
      ? supabase
          .from('feed_reactions')
          .select('feed_item_id, member_key, emoji')
          .in('feed_item_id', itemIds)
      : Promise.resolve({ data: null, error: null }),
    witnessesSupported
      ? supabase
          .from('feed_witnesses')
          .select('feed_item_id, member_key')
          .in('feed_item_id', itemIds)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (reactionsResult.error) {
    if (isMissingSocialResourceError(reactionsResult.error)) {
      setCapability('feed_reactions', false);
    } else {
      console.warn('[SocialData] feed_reactions unavailable:', reactionsResult.error.message);
    }
  } else if (reactionsSupported) {
    setCapability('feed_reactions', true);
  }

  if (witnessesResult.error) {
    if (isMissingSocialResourceError(witnessesResult.error)) {
      setCapability('feed_witnesses', false);
    } else {
      console.warn('[SocialData] feed_witnesses unavailable:', witnessesResult.error.message);
    }
  } else if (witnessesSupported) {
    setCapability('feed_witnesses', true);
  }

  const reactionsByItem = mapReactionRows((reactionsResult.data as FeedReactionRow[]) || []);
  const witnessesByItem = mapWitnessRows((witnessesResult.data as FeedWitnessRow[]) || []);

  return feedItems.map((item) => {
    const itemId = String(item.id || '');
    const mergedReactions = mergeReactionMaps(item.reactions ?? {}, reactionsByItem.get(itemId) || {});
    const mergedWitnesses = [...new Set([...(item.witnesses ?? []), ...(witnessesByItem.get(itemId) || [])].filter(Boolean))];

    return {
      ...item,
      reactions: mergedReactions,
      witnesses: mergedWitnesses,
    };
  });
}

export async function toggleStructuredReaction(params: {
  feedItemId: string;
  memberKey: string;
  emoji: string;
  hasReacted: boolean;
}): Promise<'structured' | 'legacy'> {
  if (!supabase) return 'legacy';
  if (getCapability('feed_reactions') === false) return 'legacy';

  const query = params.hasReacted
    ? supabase
        .from('feed_reactions')
        .delete()
        .eq('feed_item_id', params.feedItemId)
        .eq('member_key', params.memberKey)
        .eq('emoji', params.emoji)
    : supabase.from('feed_reactions').insert({
        feed_item_id: params.feedItemId,
        member_key: params.memberKey,
        emoji: params.emoji,
      });

  const { error } = await query;
  if (error) {
    if (isMissingSocialResourceError(error)) {
      setCapability('feed_reactions', false);
      return 'legacy';
    }
    throw error;
  }

  setCapability('feed_reactions', true);
  return 'structured';
}

export async function toggleStructuredWitness(params: {
  feedItemId: string;
  memberKey: string;
  hasWitnessed: boolean;
}): Promise<'structured' | 'legacy'> {
  if (!supabase) return 'legacy';
  if (getCapability('feed_witnesses') === false) return 'legacy';

  const query = params.hasWitnessed
    ? supabase
        .from('feed_witnesses')
        .delete()
        .eq('feed_item_id', params.feedItemId)
        .eq('member_key', params.memberKey)
    : supabase.from('feed_witnesses').insert({
        feed_item_id: params.feedItemId,
        member_key: params.memberKey,
      });

  const { error } = await query;
  if (error) {
    if (isMissingSocialResourceError(error)) {
      setCapability('feed_witnesses', false);
      return 'legacy';
    }
    throw error;
  }

  setCapability('feed_witnesses', true);
  return 'structured';
}

export async function insertFeedCommentActivity(params: {
  who: string;
  action: string;
  createdAt: string;
  parentFeedItemId?: string | null;
  contextLabel?: string | null;
  commentBody: string;
  targetMemberKey?: string | null;
  targetMemberName?: string | null;
}): Promise<{ data: Record<string, any> | null; mode: 'structured' | 'legacy'; error: Error | null }> {
  if (!supabase) return { data: null, mode: 'legacy', error: null };

  const structuredInsert = {
    who: params.who,
    action: params.action,
    xp: 0,
    created_at: params.createdAt,
    interaction_type: 'comment',
    parent_feed_item_id: params.parentFeedItemId || null,
    context_label: params.contextLabel || 'aktivitet',
    comment_body: params.commentBody,
    target_member_key: params.targetMemberKey || null,
    metadata: params.targetMemberName ? { targetMemberName: params.targetMemberName } : {},
  };

  const structuredResult = await supabase
    .from('activity_feed')
    .insert(structuredInsert)
    .select('*')
    .single();

  if (!structuredResult.error) {
    return { data: structuredResult.data as Record<string, any>, mode: 'structured', error: null };
  }

  if (!isMissingSocialResourceError(structuredResult.error)) {
    return { data: null, mode: 'structured', error: structuredResult.error };
  }

  const legacyResult = await supabase
    .from('activity_feed')
    .insert({
      who: params.who,
      action: params.action,
      xp: 0,
      created_at: params.createdAt,
    })
    .select('*')
    .single();

  if (legacyResult.error) {
    return { data: null, mode: 'legacy', error: legacyResult.error };
  }

  return { data: legacyResult.data as Record<string, any>, mode: 'legacy', error: null };
}

function toLocalNotification(row: RemoteNotificationRow): Notification {
  const payload = normalizePayload(row.payload);
  if (row.actor_member_key && !payload.memberId) {
    payload.memberId = row.actor_member_key;
  }
  if (row.feed_item_id && !payload.feedItemId) {
    payload.feedItemId = row.feed_item_id;
  }

  return {
    id: row.id,
    remoteId: row.id,
    source: 'supabase',
    type: row.type,
    ts: row.created_at ? Date.parse(row.created_at) || Date.now() : Date.now(),
    read: Boolean(row.read),
    title: row.title || undefined,
    body: row.body || undefined,
    memberKey: row.member_key,
    payload,
  };
}

export async function fetchRemoteNotifications(
  memberKey: string,
  limit = 50
): Promise<{ supported: boolean; notifications: Notification[] }> {
  if (!supabase || !memberKey) return { supported: false, notifications: [] };
  if (getCapability('notifications') === false) return { supported: false, notifications: [] };

  const { data, error } = await supabase
    .from('notifications')
    .select('id, member_key, actor_member_key, type, title, body, read, read_at, payload, feed_item_id, created_at')
    .eq('member_key', memberKey)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingSocialResourceError(error)) {
      setCapability('notifications', false);
      return { supported: false, notifications: [] };
    }

    console.warn('[SocialData] notifications unavailable:', error.message);
    return { supported: false, notifications: [] };
  }

  setCapability('notifications', true);
  return {
    supported: true,
    notifications: ((data || []) as RemoteNotificationRow[]).map(toLocalNotification),
  };
}

export function subscribeToRemoteNotifications(
  memberKey: string,
  onChange: () => void
) {
  if (!supabase || !memberKey || getCapability('notifications') === false) return null;

  const channel = supabase
    .channel(`notifications-${memberKey}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `member_key=eq.${memberKey}`,
    }, () => {
      onChange();
    })
    .subscribe();

  return channel;
}

export async function markRemoteNotificationsRead(memberKey: string, ids?: Array<string | number>): Promise<void> {
  if (!supabase || !memberKey || getCapability('notifications') === false) return;

  let query = supabase
    .from('notifications')
    .update({
      read: true,
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('member_key', memberKey)
    .eq('read', false);

  const remoteIds = (ids || []).map((id) => String(id)).filter(Boolean);
  if (remoteIds.length > 0) {
    query = query.in('id', remoteIds);
  }

  const { error } = await query;
  if (error) {
    if (isMissingSocialResourceError(error)) {
      setCapability('notifications', false);
      return;
    }
    console.warn('[SocialData] mark notifications read failed:', error.message);
    return;
  }

  setCapability('notifications', true);
}

export async function upsertPresence(params: {
  memberKey: string;
  currentSurface: string;
  isOnline?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!supabase || !params.memberKey || getCapability('member_presence') === false) return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('member_presence')
    .upsert({
      member_key: params.memberKey,
      current_surface: params.currentSurface,
      is_online: params.isOnline ?? true,
      last_seen_at: now,
      updated_at: now,
      metadata: params.metadata || {},
    }, {
      onConflict: 'member_key',
    });

  if (error) {
    if (isMissingSocialResourceError(error)) {
      setCapability('member_presence', false);
      return;
    }
    console.warn('[SocialData] presence upsert failed:', error.message);
    return;
  }

  setCapability('member_presence', true);
}

export async function fetchPresenceSnapshot(
  withinMinutes = 5
): Promise<{ supported: boolean; activeNow: number }> {
  if (!supabase) return { supported: false, activeNow: 0 };
  if (getCapability('member_presence') === false) return { supported: false, activeNow: 0 };

  const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('member_presence')
    .select('member_key')
    .eq('is_online', true)
    .gte('last_seen_at', cutoff);

  if (error) {
    if (isMissingSocialResourceError(error)) {
      setCapability('member_presence', false);
      return { supported: false, activeNow: 0 };
    }
    console.warn('[SocialData] presence snapshot failed:', error.message);
    return { supported: false, activeNow: 0 };
  }

  setCapability('member_presence', true);
  return { supported: true, activeNow: (data || []).length };
}
