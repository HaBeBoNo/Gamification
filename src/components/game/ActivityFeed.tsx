import React, { useState, useEffect, useMemo, useRef } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { ScrollText, Activity, MessageCircle, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { sendPush } from '@/lib/sendPush';
import { getFeedIntent, isFreshFeedIntent, resolveFeedIntentItem, subscribeFeedIntent } from '@/lib/feedIntent';
import { shouldPushForSocialSignal } from '@/lib/socialSignalPolicy';
import { createFeedCommentAction, getFeedCommentMeta, getFeedContextLabel } from '@/lib/feed';
import { fetchBandActivitySnapshot, hydrateFeedItems, insertFeedCommentActivity, toggleStructuredReaction, toggleStructuredWitness } from '@/lib/socialData';

// ── Helpers ───────────────────────────────────────────────────────

// ts kan vara en formaterad sträng ("14:32") eller ett numeriskt timestamp
function timeAgo(ts: number | string): string {
  if (typeof ts === 'string') return ts;
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m sedan`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h sedan`;
  return `${Math.floor(hrs / 24)}d sedan`;
}

function formatFeedTime(ts: string | number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) {
    // Redan ett HH:MM-format från gamla data — visa som det är
    return typeof ts === 'string' && ts.length <= 5 ? ts : '';
  }
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function getFeedTimestampValue(item: any): number {
  const raw = item?.created_at ?? item?.ts ?? item?.time ?? item?.t;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatRelativeActivity(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h sedan`;
  const days = Math.floor(hours / 24);
  return `${days}d sedan`;
}

function isRecentActivity(ts: number, maxAgeMs = 24 * 60 * 60 * 1000): boolean {
  return Boolean(ts) && Date.now() - ts <= maxAgeMs;
}

function getMemberName(memberKey?: string): string {
  if (!memberKey) return 'Någon';
  return (MEMBERS as Record<string, { name?: string }>)[memberKey]?.name || memberKey;
}

function buildFeedPresentation(feedItems: any[]) {
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
      attached.forEach(commentItem => hiddenCommentIds.add(String(commentItem.id || '')));
    }

    pendingSpecific.delete(specificKey);
    pendingGeneric.delete(ownerKey);
  });

  return { commentsByItemId, hiddenCommentIds };
}

// ── EVENT_MAP: händelsetyp → ikon + label ─────────────────────────
const EVENT_MAP: Record<string, { icon: string; label: string }> = {
  quest_completed:  { icon: '✅', label: 'slutförde' },
  quest_created:    { icon: '➕', label: 'skapade uppdraget' },
  check_in:         { icon: '📅', label: 'checkade in' },
  level_up:         { icon: '⬆️', label: 'gick upp till' },
  streak_milestone: { icon: '🔥', label: 'nådde streak' },
};

// Detektera ikon från entry.type, entry.category eller action-text som fallback
function getEventIcon(entry: any): string {
  const fromType = EVENT_MAP[entry.type] ?? EVENT_MAP[entry.category];
  if (fromType) return fromType.icon;
  const a = (entry.action || '').toLowerCase();
  if (a.includes('completed') || a.includes('slutförde')) return '✅';
  if (a.includes('checkade in'))                          return '📅';
  if (a.includes('nivå') || a.includes('level'))         return '⬆️';
  if (a.includes('kommenterade'))                        return '💬';
  if (a.includes('high-five'))                            return '🙌';
  if (a.includes('anslöt'))                               return '🤝';
  if (a.includes('reflekterade'))                         return '💡';
  if (a.includes('streak'))                               return '🔥';
  return '⚡';
}

// Extrahera XP ur action-text, t.ex. "(+150 XP)"
function extractXPFromText(text: string): number | null {
  const match = text.match(/\(\+(\d+)\s*XP/i);
  return match ? parseInt(match[1], 10) : null;
}

// ── Framer Motion ─────────────────────────────────────────────────
const itemVariants = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
};
const INLINE_COMMENT_PREVIEW_COUNT = 3;

type ReplyTarget = {
  memberKey?: string;
  memberName: string;
  commentId?: string;
};

function getReplyPrefix(replyTarget?: ReplyTarget | null): string {
  if (!replyTarget?.memberName) return '';
  return `@${replyTarget.memberName.split(' ')[0]} `;
}

function isCommentReady(rawDraft: string, replyTarget?: ReplyTarget | null): boolean {
  const trimmed = rawDraft.trim();
  if (!trimmed) return false;

  const replyPrefix = getReplyPrefix(replyTarget).trim();
  if (replyPrefix && trimmed === replyPrefix) return false;

  return true;
}

function sortFeedItemsByTimeAsc(items: any[]): any[] {
  return [...items].sort((a, b) => getFeedTimestampValue(a) - getFeedTimestampValue(b));
}

// ── Komponent ─────────────────────────────────────────────────────
function ActivityFeed({ hideHeader }: { hideHeader?: boolean }) {
  // feedItems hämtas direkt från Supabase för stabila UUID:n (reaktioner kräver item.id)
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bandSnapshot, setBandSnapshot] = useState<{ activeToday: number; activeNow: number | null; xp48h: number }>({
    activeToday: 0,
    activeNow: null,
    xp48h: 0,
  });
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [replyTargets, setReplyTargets] = useState<Record<string, ReplyTarget | undefined>>({});
  const [expandedCommentGroups, setExpandedCommentGroups] = useState<Record<string, boolean>>({});
  const [threadItemId, setThreadItemId] = useState<string | null>(null);
  const [intentVersion, setIntentVersion] = useState(0);
  const hasLoaded = useRef(false);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lastHandledIntentId = useRef<string | null>(null);
  const presentation = useMemo(() => buildFeedPresentation(feedItems), [feedItems]);
  const activeThreadItem = useMemo(
    () => feedItems.find((item) => String(item.id || '') === threadItemId) || null,
    [feedItems, threadItemId]
  );

  function mergeIncomingFeedItem(prev: any[], incoming: any) {
    const incomingCreatedAt = incoming?.created_at || incoming?.ts || incoming?.time;
    return [
      incoming,
      ...prev.filter(item => {
        const sameId = item.id && incoming.id && item.id === incoming.id;
        const sameOptimisticComment =
          String(item.id || '').startsWith('local-comment-') &&
          item.who === incoming.who &&
          item.action === incoming.action &&
          (item.created_at || item.ts || item.time) === incomingCreatedAt;
        return !sameId && !sameOptimisticComment;
      }),
    ].slice(0, 50);
  }

  function updateFeedItemLocal(itemId: string, updater: (item: any) => any) {
    setFeedItems(prev => prev.map(item => item.id === itemId ? updater(item) : item));
  }

  function clearReplyTarget(itemId: string) {
    setReplyTargets(prev => {
      if (!prev[itemId]) return prev;
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  function toggleCommentExpansion(itemId: string) {
    setExpandedCommentGroups(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  function openThread(item: any, replyTarget?: ReplyTarget) {
    const itemId = String(item.id || '');
    if (!itemId) return;

    setThreadItemId(itemId);
    if (replyTarget) {
      openCommentComposer(item, replyTarget);
    }
  }

  function closeThread() {
    setThreadItemId(null);
  }

  function findParentItemForComment(commentItemId: string): any | null {
    for (const [parentItemId, comments] of presentation.commentsByItemId.entries()) {
      if (comments.some((commentItem) => String(commentItem.id || '') === commentItemId)) {
        return feedItems.find((item) => String(item.id || '') === parentItemId) || null;
      }
    }
    return null;
  }

  function openCommentComposer(item: any, replyTarget?: ReplyTarget) {
    const itemId = String(item.id || '');
    if (!itemId) return;

    setOpenCommentId(itemId);

    if (replyTarget) {
      setReplyTargets(prev => ({ ...prev, [itemId]: replyTarget }));
      setCommentDrafts(prev => {
        const existing = prev[itemId]?.trim();
        if (existing) return prev;
        return { ...prev, [itemId]: getReplyPrefix(replyTarget) };
      });
    } else {
      clearReplyTarget(itemId);
    }

    window.setTimeout(() => {
      commentInputRefs.current[itemId]?.focus();
    }, 40);
  }

  async function handleToggleReaction(item: any, emoji: string) {
    const me = S.me;
    if (!me) return;

    const currentReactions: Record<string, string[]> = item.reactions ?? {};
    const existing = currentReactions[emoji] ?? [];
    const hasReacted = existing.includes(me);
    const updated = hasReacted
      ? existing.filter((k: string) => k !== me)
      : [...existing, me];

    const newReactions = { ...currentReactions, [emoji]: updated };
    if (newReactions[emoji].length === 0) delete newReactions[emoji];

    updateFeedItemLocal(item.id, current => ({ ...current, reactions: newReactions }));

    if (!item.id || String(item.id).startsWith('local-') || !supabase) return;

    try {
      const mode = await toggleStructuredReaction({
        feedItemId: String(item.id),
        memberKey: me,
        emoji,
        hasReacted,
      });

      if (mode === 'legacy') {
        const { error } = await supabase
          .from('activity_feed')
          .update({ reactions: newReactions })
          .eq('id', item.id);
        if (error) throw error;
      }
    } catch (error: any) {
      console.warn('toggleReaction failed:', error?.message || error);
      updateFeedItemLocal(item.id, current => ({ ...current, reactions: currentReactions }));
    }
  }

  async function handleToggleWitness(item: any) {
    const me = S.me;
    if (!me) return;

    const currentWitnesses: string[] = item.witnesses ?? [];
    const hasWitnessed = currentWitnesses.includes(me);
    const updated = hasWitnessed
      ? currentWitnesses.filter((k: string) => k !== me)
      : [...currentWitnesses, me];

    updateFeedItemLocal(item.id, current => ({ ...current, witnesses: updated }));

    if (!item.id || String(item.id).startsWith('local-') || !supabase) return;

    try {
      const mode = await toggleStructuredWitness({
        feedItemId: String(item.id),
        memberKey: me,
        hasWitnessed,
      });

      if (mode === 'legacy') {
        const { error } = await supabase
          .from('activity_feed')
          .update({ witnesses: updated })
          .eq('id', item.id);
        if (error) throw error;
      }
    } catch (error: any) {
      console.warn('toggleWitness failed:', error?.message || error);
      updateFeedItemLocal(item.id, current => ({ ...current, witnesses: currentWitnesses }));
    }
  }

  async function handleSubmitComment(item: any) {
    const me = S.me;
    if (!me) return;

    const itemId = String(item.id || '');
    const replyTarget = replyTargets[itemId];
    const rawDraft = commentDrafts[itemId] ?? '';
    const comment = rawDraft.trim();
    if (!isCommentReady(rawDraft, replyTarget)) return;

    const targetMemberKey = replyTarget?.memberKey || item.who || null;
    const targetName = getMemberName(targetMemberKey || undefined);
    const itemLabel = getFeedContextLabel(item);
    const action = createFeedCommentAction({
      targetName: getMemberName(item.who),
      contextLabel: itemLabel,
      comment,
      parentFeedItemId: itemId,
    });
    const createdAt = new Date().toISOString();
    const optimisticId = `local-comment-${Date.now()}`;
    const optimisticItem = {
      id: optimisticId,
      who: me,
      action,
      xp: 0,
      created_at: createdAt,
      ts: createdAt,
    };

    setSubmittingCommentId(itemId);
    setOpenCommentId(null);
    clearReplyTarget(itemId);
    setCommentDrafts(prev => ({ ...prev, [itemId]: '' }));
    setFeedItems(prev => mergeIncomingFeedItem(prev, optimisticItem));

    const targetMemberKeys = [...new Set([
      replyTarget?.memberKey,
      !replyTarget?.memberKey ? item.who : undefined,
    ].filter((memberKey): memberKey is string => Boolean(memberKey) && memberKey !== me))];

    if (shouldPushForSocialSignal('comment') && targetMemberKeys.length > 0) {
      const commenterName = getMemberName(me);
      void sendPush(
        `${commenterName} kommenterade din aktivitet`,
        comment.length > 80 ? `${comment.slice(0, 77)}...` : comment,
        {
          excludeMember: me,
          targetMemberKeys,
          url: '/',
        }
      );
    }

    if (!supabase) {
      setSubmittingCommentId(null);
      return;
    }

    const { data, error } = await insertFeedCommentActivity({
      who: me,
      action,
      createdAt,
      parentFeedItemId: itemId,
      contextLabel: itemLabel,
      commentBody: comment,
      targetMemberKey,
      targetMemberName: targetName,
    });

    if (error) {
      console.warn('create comment activity failed:', error.message);
      setFeedItems(prev => prev.filter((feedItem) => String(feedItem.id || '') !== optimisticId));
      setOpenCommentId(itemId);
      if (replyTarget) {
        setReplyTargets(prev => ({ ...prev, [itemId]: replyTarget }));
      }
      setCommentDrafts(prev => ({ ...prev, [itemId]: rawDraft }));
      setSubmittingCommentId(null);
      return;
    }

    if (data) {
      setFeedItems(prev => mergeIncomingFeedItem(prev, data));
    }
    setSubmittingCommentId(null);
  }

  // Hämta feed + prenumerera — körs en gång när S.me är känt, aldrig om igen
  useEffect(() => {
    if (!S.me || hasLoaded.current) return;
    hasLoaded.current = true;

    async function loadFeed() {
      setLoading(true);
      const { data } = await supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) {
        const hydrated = await hydrateFeedItems(data);
        setFeedItems(hydrated);
      }
      setLoading(false);
    }

    async function loadBandSnapshot() {
      const snapshot = await fetchBandActivitySnapshot();
      setBandSnapshot(snapshot);
    }

    loadFeed();
    void loadBandSnapshot();

    const channel = supabase
      .channel('activity-feed-global')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_feed',
      }, payload => {
        setFeedItems(prev => mergeIncomingFeedItem(prev, payload.new as any));
        void loadBandSnapshot();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'activity_feed',
      }, payload => {
        setFeedItems(prev =>
          prev.map(item => item.id === (payload.new as any).id ? payload.new as any : item)
        );
        void loadBandSnapshot();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'member_presence',
      }, () => {
        void loadBandSnapshot();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [S.me]);

  useEffect(() => {
    return subscribeFeedIntent(() => {
      setIntentVersion(version => version + 1);
    });
  }, []);

  useEffect(() => {
    const intent = getFeedIntent();
    if (!intent || !isFreshFeedIntent(intent) || feedItems.length === 0) return;
    if (lastHandledIntentId.current === intent.id) return;

    let targetItem = resolveFeedIntentItem(intent, feedItems);
    if (!targetItem?.id) return;

    const parsedIntentComment = getFeedCommentMeta(targetItem);
    if (parsedIntentComment) {
      targetItem = findParentItemForComment(String(targetItem.id || '')) || targetItem;
    }
    if (!targetItem?.id) return;

    const targetId = String(targetItem.id);
    lastHandledIntentId.current = intent.id;
    setHighlightedItemId(targetId);
    setThreadItemId(targetId);

    if (intent.mode === 'reply') {
      setOpenCommentId(targetId);
      if (intent.replyTarget) {
        setReplyTargets(prev => ({
          ...prev,
          [targetId]: intent.replyTarget,
        }));
      } else if (intent.draft) {
        const fallbackDraft = intent.draft;
        setReplyTargets(prev => ({
          ...prev,
          [targetId]: {
            memberName: fallbackDraft.trim().replace(/^@/, ''),
          },
        }));
      }
      if (intent.draft) {
        setCommentDrafts(prev => ({ ...prev, [targetId]: prev[targetId] || intent.draft! }));
      }
    }

    window.setTimeout(() => {
      itemRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);

    const timeoutId = window.setTimeout(() => {
      setHighlightedItemId(current => current === targetId ? null : current);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [feedItems, intentVersion]);

  // ── Synergy-hjälpare ───────────────────────────────────────────
  function isSynergy(item: any) {
    return item.synergy || (item.action && item.action.includes('[synk]'));
  }

  function parseSynergyMembers(item: any): [string, string] | null {
    if (item.memberA && item.memberB) return [item.memberA, item.memberB];
    const ids = Object.keys(MEMBERS);
    const found = ids.filter(id =>
      item.action?.toLowerCase().includes((MEMBERS as any)[id].name.toLowerCase())
    );
    if (found.length >= 2) return [found[0], found[1]];
    return null;
  }

  function renderCommentCard(commentItem: any, parentItem: any) {
    const commenter = (MEMBERS as any)[commentItem.who] || null;
    const commentTs = formatFeedTime(commentItem.ts ?? commentItem.time ?? commentItem.created_at);

    return (
      <div
        key={commentItem.id}
        style={{
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 10px',
        }}
      >
        <div style={{
          fontSize: 'var(--text-micro)',
          color: 'var(--color-text-muted)',
          marginBottom: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{commenter?.name || commentItem.who}</span>
            <span>sa:</span>
          </div>
          {commentTs && <span>{commentTs}</span>}
        </div>
        <div style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text)',
          lineHeight: 1.5,
          marginBottom: 6,
        }}>
          {commentItem.parsedComment?.comment || ''}
        </div>
        <button
          onClick={() => openThread(parentItem, {
            memberKey: commentItem.who,
            memberName: commenter?.name || commentItem.who || 'Någon',
            commentId: String(commentItem.id || ''),
          })}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-primary)',
            padding: 0,
            fontSize: 'var(--text-micro)',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          Svara
        </button>
      </div>
    );
  }

  function renderCommentComposer(item: any, forceOpen = false) {
    const itemId = String(item.id || '');
    const hasOpenComment = forceOpen || openCommentId === itemId;
    if (!hasOpenComment) return null;

    const commentDraft = commentDrafts[itemId] ?? '';
    const replyTarget = replyTargets[itemId];
    const canSubmitComment = isCommentReady(commentDraft, replyTarget);

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-xs)',
        marginTop: 'var(--space-xs)',
      }}>
        {replyTarget && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-sm)',
            background: 'var(--color-primary-muted)',
            border: '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-pill)',
            padding: '4px 10px',
          }}>
            <span style={{
              fontSize: 'var(--text-micro)',
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Svarar till {replyTarget.memberName}
            </span>
            <button
              onClick={() => clearReplyTarget(itemId)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-primary)',
                padding: 0,
                cursor: 'pointer',
                fontSize: 'var(--text-micro)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Rensa
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <input
            ref={(node) => {
              commentInputRefs.current[itemId] = node;
            }}
            type="text"
            maxLength={160}
            value={commentDraft}
            onChange={(e) => setCommentDrafts(prev => ({ ...prev, [itemId]: e.target.value }))}
            placeholder={replyTarget
              ? `Svara ${replyTarget.memberName.split(' ')[0]}...`
              : `Svara ${getMemberName(item.who).split(' ')[0]}...`}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-pill)',
              padding: '8px 12px',
              color: 'var(--color-text)',
              fontSize: 'var(--text-caption)',
            }}
          />
          <button
            onClick={() => handleSubmitComment(item)}
            disabled={!canSubmitComment || submittingCommentId === itemId}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              background: canSubmitComment ? 'var(--color-primary)' : 'var(--color-border)',
              color: canSubmitComment ? '#fff' : 'var(--color-text-muted)',
              cursor: canSubmitComment ? 'pointer' : 'not-allowed',
              fontSize: 'var(--text-caption)',
              whiteSpace: 'nowrap',
            }}
          >
            {submittingCommentId === itemId ? '...' : 'Skicka'}
          </button>
        </div>
      </div>
    );
  }

  function renderThreadOverlay() {
    if (!activeThreadItem) return null;

    const itemId = String(activeThreadItem.id || '');
    const member = (MEMBERS as any)[activeThreadItem.who] || null;
    const actionText = activeThreadItem.action || '';
    const questMatch = actionText.match(/[""]([^""]+)[""]/);
    const questTitle = questMatch ? questMatch[1] : null;
    let displayAction = actionText
      .replace(/[""][^""]+[""]/, '')
      .replace(/\(\+\d+\s*XP[^)]*\)/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (displayAction.endsWith(',')) displayAction = displayAction.slice(0, -1).trim();
    const xp = activeThreadItem.xp || extractXPFromText(actionText) || 0;
    const ts = formatFeedTime(activeThreadItem.ts ?? activeThreadItem.time ?? activeThreadItem.t ?? activeThreadItem.created_at);
    const threadComments = sortFeedItemsByTimeAsc(presentation.commentsByItemId.get(itemId) || []);
    const lastThreadActivityTs = threadComments.length > 0
      ? getFeedTimestampValue(threadComments[threadComments.length - 1])
      : getFeedTimestampValue(activeThreadItem);
    const itemReactions: Record<string, string[]> = activeThreadItem.reactions ?? {};
    const witnessNames = (activeThreadItem.witnesses ?? []).map((memberId: string) => getMemberName(memberId));

    return (
      <div className="overlay-backdrop" onClick={closeThread}>
        <div
          className="overlay-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: 720,
            width: 'min(720px, calc(100vw - 24px))',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              <MessageCircle size={14} />
              Aktivitetstråd
            </div>
            <button
              onClick={closeThread}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{
            padding: 'var(--space-lg)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-md)',
          }}>
            <div style={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-md)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-md)',
              }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: member?.xpColor || 'var(--color-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MemberIcon id={String(activeThreadItem.who || '').toLowerCase()} size={24} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 'var(--space-sm)',
                    alignItems: 'center',
                    marginBottom: 6,
                    flexWrap: 'wrap',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className="feed-name">{member?.name || activeThreadItem.who || '?'}</span>
                      {ts && (
                        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                          {ts}
                        </span>
                      )}
                    </div>
                    {xp > 0 && <span className="feed-xp">+{xp} XP</span>}
                  </div>
                  <div style={{
                    fontSize: 'var(--text-caption)',
                    color: 'var(--color-text)',
                    lineHeight: 1.6,
                  }}>
                    <span>{displayAction}</span>
                    {questTitle && <span className="feed-quest"> "{questTitle}"</span>}
                  </div>
                  {Object.keys(itemReactions).length > 0 && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginTop: 'var(--space-xs)',
                    }}>
                      {Object.entries(itemReactions).map(([emoji, memberIds]) => (
                        <span
                          key={emoji}
                          style={{
                            fontSize: 'var(--text-micro)',
                            color: 'var(--color-text-muted)',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-pill)',
                            padding: '2px 8px',
                          }}
                        >
                          {emoji} {(memberIds as string[]).map((memberId) => getMemberName(memberId)).join(', ')}
                        </span>
                      ))}
                    </div>
                  )}
                  {witnessNames.length > 0 && (
                    <div style={{
                      fontSize: 'var(--text-micro)',
                      color: 'var(--color-text-muted)',
                      marginTop: 'var(--space-xs)',
                    }}>
                      Var där: {witnessNames.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-sm)',
              flexWrap: 'wrap',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                {threadComments.length} svar i tråden
                {lastThreadActivityTs > 0 && ` · senast aktiv ${formatRelativeActivity(lastThreadActivityTs)}`}
              </div>
              <button
                onClick={() => openCommentComposer(activeThreadItem)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 'var(--text-micro)',
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Svara i tråd
              </button>
            </div>

            {threadComments.length === 0 ? (
              <div style={{
                background: 'var(--color-surface-elevated)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-lg)',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-caption)',
                textAlign: 'center',
              }}>
                Inga svar ännu. Första kommentaren kan vara din.
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-sm)',
              }}>
                {threadComments.map((commentItem: any) => renderCommentCard(commentItem, activeThreadItem))}
              </div>
            )}

            {renderCommentComposer(activeThreadItem, true)}
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <>
    <div className="panel">
      {!hideHeader && (
        <div className="panel-header">
          <div className="panel-title">
            <ScrollText size={14} strokeWidth={2} />
            AKTIVITET
          </div>
        </div>
      )}

      {/* ── Bandstatus-rad ─────────────────────────────────────── */}
      {(bandSnapshot.activeToday > 0 || bandSnapshot.xp48h > 0 || bandSnapshot.activeNow !== null) && (
        <div className="feed-band-status">
          <span>⚡ {bandSnapshot.activeToday} aktiva idag</span>
          {bandSnapshot.activeNow !== null && (
            <>
              <span className="feed-band-sep"> · </span>
              <span className="feed-band-xp">{bandSnapshot.activeNow} live nu</span>
            </>
          )}
          {bandSnapshot.xp48h > 0 && (
            <>
              <span className="feed-band-sep"> · </span>
              <span className="feed-band-xp">{bandSnapshot.xp48h} XP / 48h</span>
            </>
          )}
        </div>
      )}

      {/* ── Tom state / loading ────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: 'var(--space-lg)' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ marginBottom: 'var(--space-lg)' }}>
              <div style={{
                display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start',
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-elevated)',
                opacity: 0.6,
                animation: 'pulse 2s ease-in-out infinite',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--color-border)', flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    height: 12, borderRadius: 4,
                    background: 'var(--color-border)', marginBottom: 8,
                    width: '80%',
                  }} />
                  <div style={{
                    height: 10, borderRadius: 4,
                    background: 'var(--color-border)',
                    width: '60%',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : feedItems.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-xl) var(--space-lg)' }}>
          <Activity size={48} strokeWidth={1} />
          <div className="empty-text">Ingen aktivitet ännu. Första steget är ditt.</div>
        </div>
      ) : (
        <div className="feed-list feed-list-flat">
          {feedItems.map((item: any, i: number) => {
            const itemId = String(item.id || '');
            const parsedComment = getFeedCommentMeta(item);
            const inlineComments = sortFeedItemsByTimeAsc(presentation.commentsByItemId.get(itemId) || []);
            const areCommentsExpanded = expandedCommentGroups[itemId] || false;
            const visibleInlineComments = areCommentsExpanded
              ? inlineComments
              : inlineComments.slice(0, INLINE_COMMENT_PREVIEW_COUNT);
            const latestComment = inlineComments[0];
            const latestCommentTs = latestComment ? getFeedTimestampValue(latestComment) : 0;
            const latestCommenterName = latestComment ? getMemberName(latestComment.who) : '';
            const hasRecentExternalThreadActivity = inlineComments.some((commentItem: any) =>
              commentItem.who &&
              commentItem.who !== S.me &&
              isRecentActivity(getFeedTimestampValue(commentItem))
            );
            const threadSignalLabel = hasRecentExternalThreadActivity
              ? (item.who === S.me ? 'Nytt svar' : 'Nytt i tråden')
              : '';
            const hideStandaloneComment = parsedComment && presentation.hiddenCommentIds.has(itemId);

            if (hideStandaloneComment) {
              return null;
            }

            // ── Synergy-kort ──────────────────────────────────────
            if (isSynergy(item)) {
              const members = parseSynergyMembers(item);
              const mA = members ? (MEMBERS as any)[members[0]] : null;
              const mB = members ? (MEMBERS as any)[members[1]] : null;
              const ts = formatFeedTime(item.ts ?? item.time ?? item.t);
              return (
                <motion.div
                  key={i}
                  className="feed-synergy"
                  style={{
                    '--synergy-color-a': mA?.xpColor || 'var(--color-primary)',
                    '--synergy-color-b': mB?.xpColor || 'var(--color-green)',
                  } as React.CSSProperties}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                >
                  <div className="feed-synergy-avatars">
                    {mA && (
                      <div className="feed-synergy-avatar" style={{ background: mA.xpColor }}>
                        {mA.emoji}
                      </div>
                    )}
                    <div className="feed-synergy-line" />
                    {mB && (
                      <div className="feed-synergy-avatar" style={{ background: mB.xpColor }}>
                        {mB.emoji}
                      </div>
                    )}
                  </div>
                  <div className="feed-synergy-text">
                    {item.action?.replace('[synk]', '').trim()}
                  </div>
                  <div className="feed-synergy-ts">{ts}</div>
                </motion.div>
              );
            }

            if (parsedComment) {
              const commenter = (MEMBERS as any)[item.who] || null;
              const targetMember = parsedComment.targetKey ? (MEMBERS as any)[parsedComment.targetKey] : null;
              const ts = formatFeedTime(item.ts ?? item.time ?? item.created_at);
              return (
                <motion.div
                  key={item.id || i}
                  className="feed-row"
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <div
                    className="feed-avatar"
                    style={{ background: commenter?.xpColor || 'var(--color-surface-elevated)' }}
                  >
                    {commenter ? <MemberIcon id={(item.who ?? '').toLowerCase()} size={28} /> : '💬'}
                  </div>

                  <div className="feed-content">
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 4,
                      flexWrap: 'wrap',
                    }}>
                      <span className="feed-name">{commenter?.name || item.who || '?'}</span>
                      <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                        svarade {targetMember ? `på ${targetMember.name}` : ''}
                      </span>
                      {parsedComment.contextLabel !== 'aktivitet' && (
                        <span className="feed-quest">"{parsedComment.contextLabel}"</span>
                      )}
                    </div>
                    <div style={{
                      background: 'var(--color-surface-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px',
                      color: 'var(--color-text)',
                      fontSize: 'var(--text-caption)',
                      lineHeight: 1.5,
                    }}>
                      {parsedComment.comment}
                    </div>
                  </div>

                  <div className="feed-meta">
                    <span className="feed-time">{ts}</span>
                  </div>
                </motion.div>
              );
            }

            // ── Standard feed-rad ─────────────────────────────────
            const KNOWN_MEMBERS = ['hannes','ludvig','martin','nisse','simon','johannes','carl','niklas'];
            const memberKey = (item.who ?? '').toLowerCase();
            const hasIcon = KNOWN_MEMBERS.includes(memberKey);
            const member   = (MEMBERS as any)[item.who] || null;
            const icon     = getEventIcon(item);
            // BUG-FIX: texten ligger i item.action, INTE item.text
            const actionText = item.action || '';
            // XP: explicit fält eller extraherat ur action-text
            const xp         = item.xp || extractXPFromText(actionText) || 0;
            // Timestamp: item.ts (useXP.js) eller item.time (övriga)
            const ts         = formatFeedTime(item.ts ?? item.time ?? item.t);

            // Extrahera citerad quest-titel: "Titel"
            const questMatch = actionText.match(/[""]([^""]+)[""]/);
            const questTitle = questMatch ? questMatch[1] : null;

            // Rensa action-texten från citerad titel och XP-notering
            let displayAction = actionText
              .replace(/[""][^""]+[""]/, '')
              .replace(/\(\+\d+\s*XP[^)]*\)/gi, '')
              .replace(/\s{2,}/g, ' ')
              .trim();
            // Ta bort avslutande komma om det uppstår
            if (displayAction.endsWith(',')) displayAction = displayAction.slice(0, -1).trim();

            // Reaktioner för detta item
            const itemReactions: Record<string, string[]> = item.reactions ?? {};
            const hasOpenComment = openCommentId === item.id;
            const replyTarget = replyTargets[item.id];
            const witnessNames = (item.witnesses ?? []).map((memberId: string) => getMemberName(memberId));
            const feedbackReactionLabels = Object.entries(itemReactions)
              .flatMap(([emoji, memberIds]) =>
                (memberIds as string[])
                  .filter((memberId: string) => memberId && memberId !== item.who)
                  .map((memberId: string) => `${emoji} ${getMemberName(memberId)}`)
              );
            const feedbackWitnessLabels = (item.witnesses ?? [])
              .filter((memberId: string) => memberId && memberId !== item.who)
              .map((memberId: string) => `✍️ ${getMemberName(memberId)}`);
            const socialFeedback = [...feedbackReactionLabels, ...feedbackWitnessLabels].slice(0, 4);

            return (
              <motion.div
                key={item.id || i}
                className="feed-row"
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                ref={(node) => {
                  itemRefs.current[String(item.id || i)] = node;
                }}
                style={highlightedItemId === String(item.id || i)
                  ? {
                      boxShadow: '0 0 0 1px var(--color-primary), 0 0 0 4px var(--color-primary-muted)',
                      borderRadius: 'var(--radius-lg)',
                    }
                  : undefined}
              >
                {/* Vänster: avatar */}
                <div
                  className="feed-avatar"
                  style={{ background: member?.xpColor || 'var(--color-surface-elevated)' }}
                >
                  {hasIcon
                    ? <MemberIcon id={memberKey} size={28} />
                    : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>?</div>
                  }
                </div>

                {/* Mitten: text */}
                <div className="feed-content">
                  <span className="feed-name">{member?.name || item.who || '?'}</span>
                  <span className="feed-action"> {displayAction}</span>
                  {questTitle && (
                    <span className="feed-quest"> "{questTitle}"</span>
                  )}

                  {(socialFeedback.length > 0 || inlineComments.length > 0) && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-xs)',
                      marginTop: 'var(--space-xs)',
                    }}>
                      {socialFeedback.length > 0 && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}>
                          {socialFeedback.map((label, idx) => (
                            <span
                              key={`${label}-${idx}`}
                              style={{
                                fontSize: 'var(--text-micro)',
                                color: 'var(--color-text-muted)',
                                background: 'var(--color-surface-elevated)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-pill)',
                                padding: '2px 8px',
                              }}
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}

                      {inlineComments.length > 0 && (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 'var(--space-sm)',
                            flexWrap: 'wrap',
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-xs)',
                              flexWrap: 'wrap',
                            }}>
                              <span style={{
                                fontSize: 'var(--text-micro)',
                                color: 'var(--color-text-muted)',
                                fontFamily: 'var(--font-mono)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                              }}>
                                {inlineComments.length} svar
                              </span>
                              {latestCommentTs > 0 && (
                                <span style={{
                                  fontSize: 'var(--text-micro)',
                                  color: 'var(--color-text-muted)',
                                }}>
                                  Senast aktiv {formatRelativeActivity(latestCommentTs)}
                                </span>
                              )}
                              {latestCommenterName && (
                                <span style={{
                                  fontSize: 'var(--text-micro)',
                                  color: 'var(--color-text-muted)',
                                }}>
                                  {latestCommenterName}
                                </span>
                              )}
                            </div>
                            {threadSignalLabel && (
                              <span style={{
                                fontSize: 'var(--text-micro)',
                                color: 'var(--color-primary)',
                                background: 'var(--color-primary-muted)',
                                border: '1px solid var(--color-primary)',
                                borderRadius: 'var(--radius-pill)',
                                padding: '2px 8px',
                                fontFamily: 'var(--font-mono)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                              }}>
                                {threadSignalLabel}
                              </span>
                            )}
                          </div>

                          {visibleInlineComments.map((commentItem: any) => renderCommentCard(commentItem, item))}

                          {(inlineComments.length > INLINE_COMMENT_PREVIEW_COUNT || areCommentsExpanded) && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-md)',
                              flexWrap: 'wrap',
                            }}>
                              {inlineComments.length > INLINE_COMMENT_PREVIEW_COUNT && (
                                <button
                                  onClick={() => toggleCommentExpansion(itemId)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--color-primary)',
                                    padding: 0,
                                    fontSize: 'var(--text-micro)',
                                    fontFamily: 'var(--font-mono)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {areCommentsExpanded
                                    ? 'Dölj svar'
                                    : `Visa ${inlineComments.length - INLINE_COMMENT_PREVIEW_COUNT} till`}
                                </button>
                              )}
                              <button
                                onClick={() => openThread(item)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--color-text-muted)',
                                  padding: 0,
                                  fontSize: 'var(--text-micro)',
                                  fontFamily: 'var(--font-mono)',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.08em',
                                  cursor: 'pointer',
                                }}
                              >
                                Öppna tråd
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Reaktionsknappar ───────────────────────── */}
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
                    {(['🔥', '👏', '💀'] as const).map(emoji => {
                      const reactors = itemReactions[emoji] ?? [];
                      const hasReacted = S.me ? reactors.includes(S.me) : false;
                      return (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(item, emoji)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-pill)',
                            border: `1px solid ${hasReacted ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            background: hasReacted ? 'var(--color-primary-muted)' : 'var(--color-surface-elevated)',
                            cursor: 'pointer',
                            fontSize: 'var(--text-caption)',
                            color: hasReacted ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          }}
                        >
                          {emoji} {reactors.length > 0 && <span>{reactors.length}</span>}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => {
                        if (hasOpenComment && !replyTarget) {
                          setOpenCommentId(null);
                          return;
                        }
                        openCommentComposer(item);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        border: `1px solid ${hasOpenComment ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: hasOpenComment ? 'var(--color-primary-muted)' : 'var(--color-surface-elevated)',
                        cursor: 'pointer',
                        fontSize: 'var(--text-caption)',
                        color: hasOpenComment ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      💬 Kommentera
                    </button>
                    <button
                      onClick={() => openThread(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-pill)',
                        border: `1px solid ${hasRecentExternalThreadActivity ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: hasRecentExternalThreadActivity ? 'var(--color-primary-muted)' : 'var(--color-surface-elevated)',
                        cursor: 'pointer',
                        fontSize: 'var(--text-caption)',
                        color: hasRecentExternalThreadActivity ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      🧵 Tråd {inlineComments.length > 0 && <span>{inlineComments.length}</span>}
                    </button>
                  </div>

                  {renderCommentComposer(item)}

                  {/* ── Witness-rad (för item.xp >= 50) ────────────────── */}
                  {(item.xp ?? 0) >= 50 && (
                    <div style={{ marginTop: 'var(--space-xs)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <button
                        onClick={() => handleToggleWitness(item)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 10px',
                          borderRadius: 'var(--radius-pill)',
                          border: `1px solid ${(item.witnesses ?? []).includes(S.me!) ? 'var(--color-accent)' : 'var(--color-border)'}`,
                          background: (item.witnesses ?? []).includes(S.me!) ? 'var(--color-accent-muted)' : 'var(--color-surface-elevated)',
                          cursor: 'pointer',
                          fontSize: 'var(--text-caption)',
                          color: (item.witnesses ?? []).includes(S.me!) ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        }}
                      >
                        ✍️ Jag var där {(item.witnesses ?? []).length > 0 && `· ${item.witnesses.length}`}
                      </button>
                      {(item.witnesses ?? []).length > 0 && (
                        <span style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
                          {witnessNames.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Höger: XP + tid */}
                <div className="feed-meta">
                  {xp > 0 && <span className="feed-xp">+{xp} XP</span>}
                  <span className="feed-time">{ts}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
    {renderThreadOverlay()}
    </>
  );
}

export default React.memo(ActivityFeed);
