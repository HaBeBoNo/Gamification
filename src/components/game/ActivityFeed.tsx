import React, { useState, useEffect, useMemo, useRef } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { ScrollText, Activity, MessageCircle, X, Zap, Radio, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { getFeedIntent, isFreshFeedIntent, resolveFeedIntentItem, subscribeFeedIntent } from '@/lib/feedIntent';
import { shouldPushForSocialSignal } from '@/lib/socialSignalPolicy';
import {
  createFeedCommentAction,
  getCommentActionTargetName,
  getCommentNotificationTargets,
  getFeedCommentMeta,
  getFeedContextLabel,
} from '@/lib/feed';
import { notifyMembersSignal } from '@/lib/notificationSignals';
import { insertFeedCommentActivity, toggleStructuredReaction, toggleStructuredWitness } from '@/lib/socialData';
import {
  buildFeedPresentation,
  extractXPFromText,
  formatFeedTime,
  formatRelativeActivity,
  getFeedTimestampValue,
  getMemberName,
  getReplyPrefix,
  isCommentReady,
  isRecentActivity,
  mergeIncomingFeedItem,
  sanitizeReactionDraft,
  sortFeedItemsByTimeAsc,
  type ReplyTarget,
} from '@/lib/activityFeed';
import { useActivityFeedData } from '@/hooks/useActivityFeedData';

// ── Framer Motion ─────────────────────────────────────────────────
const itemVariants = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
};
const INLINE_COMMENT_PREVIEW_COUNT = 2;
const QUICK_REACTIONS = ['👏', '🔥', '❤️', '🎯'] as const;

// ── Komponent ─────────────────────────────────────────────────────
function ActivityFeed({ hideHeader, compact }: { hideHeader?: boolean; compact?: boolean }) {
  const { feedItems, setFeedItems, loading, bandSnapshot } = useActivityFeedData();
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [replyTargets, setReplyTargets] = useState<Record<string, ReplyTarget | undefined>>({});
  const [expandedCommentGroups, setExpandedCommentGroups] = useState<Record<string, boolean>>({});
  const [threadItemId, setThreadItemId] = useState<string | null>(null);
  const [openReactionPickerId, setOpenReactionPickerId] = useState<string | null>(null);
  const [customReactionInputId, setCustomReactionInputId] = useState<string | null>(null);
  const [customReactionDrafts, setCustomReactionDrafts] = useState<Record<string, string>>({});
  const [intentVersion, setIntentVersion] = useState(0);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const customReactionInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lastHandledIntentId = useRef<string | null>(null);
  const presentation = useMemo(() => buildFeedPresentation(feedItems), [feedItems]);
  const activeThreadItem = useMemo(
    () => feedItems.find((item) => String(item.id || '') === threadItemId) || null,
    [feedItems, threadItemId]
  );

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

  function toggleReactionPicker(item: any) {
    const itemId = String(item.id || '');
    if (!itemId) return;

    setOpenReactionPickerId((current) => current === itemId ? null : itemId);
    setCustomReactionInputId(null);
    setOpenCommentId((current) => current === itemId ? current : null);
  }

  function closeReactionPicker(itemId?: string) {
    if (!itemId) {
      setOpenReactionPickerId(null);
      setCustomReactionInputId(null);
      return;
    }
    setOpenReactionPickerId((current) => current === itemId ? null : current);
    setCustomReactionInputId((current) => current === itemId ? null : current);
  }

  function openThread(item: any, replyTarget?: ReplyTarget) {
    const itemId = String(item.id || '');
    if (!itemId) return;

    setThreadItemId(itemId);
    closeReactionPicker(itemId);
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
    closeReactionPicker(itemId);

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

      if (!hasReacted && shouldPushForSocialSignal('reaction') && item.who && item.who !== me) {
        await notifyMembersSignal({
          targetMemberKeys: [item.who],
          type: 'feed_reaction',
          title: `${getMemberName(me)} reagerade på din aktivitet`,
          body: `${emoji} på ${getFeedContextLabel(item)}`,
          dedupeKey: `reaction:${item.id}|${emoji}|${me}`,
          feedItemId: String(item.id),
          payload: {
            memberId: me,
            emoji,
            contextLabel: getFeedContextLabel(item),
            feedItemId: String(item.id),
          },
          push: {
            title: `${getMemberName(me)} reagerade på din aktivitet`,
            body: `${emoji} på ${getFeedContextLabel(item)}`,
            excludeMember: me,
            url: '/',
          },
        });
      }
    } catch (error: any) {
      console.warn('toggleReaction failed:', error?.message || error);
      updateFeedItemLocal(item.id, current => ({ ...current, reactions: currentReactions }));
    }
  }

  async function handleSubmitCustomReaction(item: any) {
    const itemId = String(item.id || '');
    const emoji = sanitizeReactionDraft(customReactionDrafts[itemId] ?? '');
    if (!emoji) return;

    await handleToggleReaction(item, emoji);
    setCustomReactionDrafts(prev => ({ ...prev, [itemId]: '' }));
    setCustomReactionInputId(null);
    setOpenReactionPickerId(null);
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

      if (!hasWitnessed && shouldPushForSocialSignal('witness') && item.who && item.who !== me) {
        await notifyMembersSignal({
          targetMemberKeys: [item.who],
          type: 'feed_witness',
          title: `${getMemberName(me)} var där`,
          body: getFeedContextLabel(item),
          dedupeKey: `witness:${item.id}|${me}`,
          feedItemId: String(item.id),
          payload: {
            memberId: me,
            contextLabel: getFeedContextLabel(item),
            feedItemId: String(item.id),
          },
          push: {
            title: `${getMemberName(me)} var där`,
            body: getFeedContextLabel(item),
            excludeMember: me,
            url: '/',
          },
        });
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

    const targetMemberKey = item.who || replyTarget?.memberKey || null;
    const targetName = getCommentActionTargetName({
      ownerName: getMemberName(item.who),
      replyTargetName: replyTarget?.memberName,
    });
    const itemLabel = getFeedContextLabel(item);
    const action = createFeedCommentAction({
      targetName,
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

    const targetMemberKeys = getCommentNotificationTargets({
      actorKey: me,
      ownerKey: item.who,
      replyTargetKey: replyTarget?.memberKey,
    });

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

    if (shouldPushForSocialSignal('comment') && targetMemberKeys.length > 0) {
      const commenterName = getMemberName(me);
      await notifyMembersSignal({
        targetMemberKeys,
        type: 'feed_comment',
        title: `${commenterName} kommenterade din aktivitet`,
        body: comment,
        dedupeKey: `comment:${data?.id || optimisticId}`,
        feedItemId: String(data?.id || itemId),
        payload: {
          memberId: me,
          comment,
          contextLabel: itemLabel,
          feedEventId: String(data?.id || optimisticId),
          feedItemId: String(data?.id || itemId),
          parentFeedItemId: itemId,
        },
        push: {
          title: `${commenterName} kommenterade din aktivitet`,
          body: comment.length > 80 ? `${comment.slice(0, 77)}...` : comment,
          excludeMember: me,
          url: '/',
        },
      });
    }

    if (data) {
      setFeedItems(prev => mergeIncomingFeedItem(prev, data));
    }
    setSubmittingCommentId(null);
  }

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
          onClick={(e) => {
            e.stopPropagation();
            openThread(parentItem, {
            memberKey: commentItem.who,
            memberName: commenter?.name || commentItem.who || 'Någon',
            commentId: String(commentItem.id || ''),
            });
          }}
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
      }}
      onClick={(e) => e.stopPropagation()}
      >
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSubmitComment(item);
              }
            }}
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
            onClick={() => { void handleSubmitComment(item); }}
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
    const fullscreenThread = typeof window !== 'undefined' && window.innerWidth < 768;
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
    const hasOpenComment = openCommentId === itemId;
    const isReactionPickerOpen = openReactionPickerId === itemId;
    const isCustomReactionInputOpen = customReactionInputId === itemId;
    const customReactionDraft = customReactionDrafts[itemId] ?? '';
    const canSubmitCustomReaction = Boolean(sanitizeReactionDraft(customReactionDraft));
    const witnessedByMe = S.me ? (activeThreadItem.witnesses ?? []).includes(S.me) : false;

    return (
      <div className={`overlay-backdrop activity-thread-backdrop${fullscreenThread ? ' is-mobile' : ''}`} onClick={closeThread}>
        <div
          className={`overlay-card activity-thread-card${fullscreenThread ? ' is-mobile' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="activity-thread-header">
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
              Aktivitet
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

          <div className="activity-thread-scroll">
            <div style={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: '22px',
              padding: '18px 18px 16px',
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

              <div style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 14,
              }}>
                <button
                  onClick={() => {
                    if (isReactionPickerOpen) {
                      closeReactionPicker(itemId);
                      return;
                    }
                    toggleReactionPicker(activeThreadItem);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    minHeight: 40,
                    padding: '0 14px',
                    borderRadius: 'var(--radius-pill)',
                    border: `1px solid ${isReactionPickerOpen ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: isReactionPickerOpen ? 'var(--color-primary-muted)' : 'var(--color-surface)',
                    color: isReactionPickerOpen ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-caption)',
                    fontFamily: 'var(--font-ui)',
                    touchAction: 'manipulation',
                  }}
                >
                  Reagera
                </button>
                <button
                  onClick={() => openCommentComposer(activeThreadItem)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    minHeight: 40,
                    padding: '0 14px',
                    borderRadius: 'var(--radius-pill)',
                    border: `1px solid ${hasOpenComment ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: hasOpenComment ? 'var(--color-primary-muted)' : 'var(--color-surface)',
                    color: hasOpenComment ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-caption)',
                    fontFamily: 'var(--font-ui)',
                    touchAction: 'manipulation',
                  }}
                >
                  Kommentera
                </button>
                <button
                  onClick={() => { void handleToggleWitness(activeThreadItem); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    minHeight: 40,
                    padding: '0 14px',
                    borderRadius: 'var(--radius-pill)',
                    border: `1px solid ${witnessedByMe ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: witnessedByMe ? 'var(--color-primary-muted)' : 'var(--color-surface)',
                    color: witnessedByMe ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-caption)',
                    fontFamily: 'var(--font-ui)',
                    touchAction: 'manipulation',
                  }}
                >
                  <Radio size={12} strokeWidth={1.9} />
                  Jag var där
                </button>
              </div>

              {isReactionPickerOpen && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-xs)',
                    marginTop: 'var(--space-sm)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-xs)',
                  }}>
                    {QUICK_REACTIONS.map((emoji) => {
                      const reactors = itemReactions[emoji] ?? [];
                      const hasReacted = S.me ? reactors.includes(S.me) : false;
                      return (
                        <button
                          key={emoji}
                          onClick={() => {
                            void handleToggleReaction(activeThreadItem, emoji);
                            closeReactionPicker(itemId);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-pill)',
                            border: `1px solid ${hasReacted ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            background: hasReacted ? 'var(--color-primary-muted)' : 'var(--color-surface)',
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
                        setCustomReactionInputId((current) => current === itemId ? null : itemId);
                        window.setTimeout(() => {
                          customReactionInputRefs.current[itemId]?.focus();
                        }, 40);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-pill)',
                        border: `1px solid ${isCustomReactionInputOpen ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: isCustomReactionInputOpen ? 'var(--color-primary-muted)' : 'var(--color-surface)',
                        cursor: 'pointer',
                        fontSize: 'var(--text-caption)',
                        color: isCustomReactionInputOpen ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      Egen emoji
                    </button>
                  </div>

                  {isCustomReactionInputOpen && (
                    <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                      <input
                        ref={(node) => {
                          customReactionInputRefs.current[itemId] = node;
                        }}
                        type="text"
                        inputMode="text"
                        maxLength={8}
                        value={customReactionDraft}
                        onChange={(e) => setCustomReactionDrafts((prev) => ({ ...prev, [itemId]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleSubmitCustomReaction(activeThreadItem);
                          }
                        }}
                        placeholder="😀"
                        style={{
                          flex: 1,
                          minWidth: 0,
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-pill)',
                          padding: '8px 12px',
                          color: 'var(--color-text)',
                          fontSize: 'var(--text-caption)',
                        }}
                      />
                      <button
                        onClick={() => { void handleSubmitCustomReaction(activeThreadItem); }}
                        disabled={!canSubmitCustomReaction}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-pill)',
                          border: 'none',
                          background: canSubmitCustomReaction ? 'var(--color-primary)' : 'var(--color-border)',
                          color: canSubmitCustomReaction ? '#fff' : 'var(--color-text-muted)',
                          cursor: canSubmitCustomReaction ? 'pointer' : 'not-allowed',
                          fontSize: 'var(--text-caption)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Lägg till
                      </button>
                    </div>
                  )}
                </div>
              )}
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
                Inga svar än.
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
          </div>

          <div className="activity-thread-composer-shell">
            {renderCommentComposer(activeThreadItem, true)}
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <>
    <div className={`panel activity-panel${compact ? ' activity-panel-compact' : ''}`}>
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
        <div className={`feed-band-status${compact ? ' is-compact' : ''}`}>
          <div className="feed-band-chip">
            <span className="feed-band-chip-icon"><Zap size={13} strokeWidth={2} /></span>
            <span className="feed-band-chip-value">{bandSnapshot.activeToday}</span>
            <span className="feed-band-chip-label">aktiva idag</span>
          </div>
          {bandSnapshot.activeNow !== null && (
            <div className="feed-band-chip">
              <span className="feed-band-chip-icon"><Radio size={13} strokeWidth={2} /></span>
              <span className="feed-band-chip-value">{bandSnapshot.activeNow}</span>
              <span className="feed-band-chip-label">live nu</span>
            </div>
          )}
          {bandSnapshot.xp48h > 0 && (
            <div className="feed-band-chip">
              <span className="feed-band-chip-icon"><BarChart3 size={13} strokeWidth={2} /></span>
              <span className="feed-band-chip-value">{bandSnapshot.xp48h}</span>
              <span className="feed-band-chip-label">XP / 48h</span>
            </div>
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
          <div className="empty-text">Tomt just nu.</div>
        </div>
      ) : (
        <div className={`feed-list feed-list-flat ${compact ? 'feed-list-compact' : 'feed-list-roomy'}`}>
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
                        <MemberIcon id={members?.[0] as any} size={18} />
                      </div>
                    )}
                    <div className="feed-synergy-line" />
                    {mB && (
                      <div className="feed-synergy-avatar" style={{ background: mB.xpColor }}>
                        <MemberIcon id={members?.[1] as any} size={18} />
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
                    {commenter ? (
                      <MemberIcon id={(item.who ?? '').toLowerCase()} size={28} />
                    ) : (
                      <MessageCircle size={18} strokeWidth={1.9} />
                    )}
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
            const hasOpenComment = openCommentId === itemId;
            const replyTarget = replyTargets[itemId];
            const reactionSummary = Object.entries(itemReactions)
              .filter(([, memberIds]) => (memberIds as string[]).length > 0)
              .map(([emoji, memberIds]) => `${emoji} ${(memberIds as string[]).length}`)
              .slice(0, 4);
            const witnessCount = (item.witnesses ?? []).length;
            const isReactionPickerOpen = openReactionPickerId === itemId;
            const isCustomReactionInputOpen = customReactionInputId === itemId;
            const customReactionDraft = customReactionDrafts[itemId] ?? '';
            const canSubmitCustomReaction = Boolean(sanitizeReactionDraft(customReactionDraft));

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
                role="button"
                tabIndex={0}
                onClick={() => openThread(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openThread(item);
                  }
                }}
                style={highlightedItemId === String(item.id || i)
                  ? {
                      boxShadow: '0 0 0 1px var(--color-primary), 0 0 0 4px var(--color-primary-muted)',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                    }
                  : { cursor: 'pointer' }}
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

                  {(reactionSummary.length > 0 || witnessCount > 0 || inlineComments.length > 0) && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-xs)',
                      marginTop: 'var(--space-xs)',
                    }}>
                      {(reactionSummary.length > 0 || witnessCount > 0) && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          fontSize: 'var(--text-micro)',
                          color: 'var(--color-text-muted)',
                        }}>
                          {reactionSummary.map((label) => (
                            <span key={label}>{label}</span>
                          ))}
                          {witnessCount > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Radio size={12} strokeWidth={1.9} />
                              {witnessCount}
                            </span>
                          )}
                          {threadSignalLabel && (
                            <span style={{ color: 'var(--color-primary)' }}>{threadSignalLabel}</span>
                          )}
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
                            </div>
                          </div>

                          {visibleInlineComments.map((commentItem: any) => renderCommentCard(commentItem, item))}

                          {inlineComments.length > INLINE_COMMENT_PREVIEW_COUNT && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-sm)',
                              flexWrap: 'wrap',
                            }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCommentExpansion(itemId);
                                }}
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openThread(item);
                                }}
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
                                Öppna aktivitet
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        if (isReactionPickerOpen) {
                          closeReactionPicker(itemId);
                          return;
                        }
                        toggleReactionPicker(item);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-pill)',
                        border: `1px solid ${isReactionPickerOpen ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: isReactionPickerOpen ? 'var(--color-primary-muted)' : 'var(--color-surface-elevated)',
                        cursor: 'pointer',
                        fontSize: 'var(--text-caption)',
                        color: isReactionPickerOpen ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      Reagera
                    </button>
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
                        gap: 6,
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-pill)',
                        border: `1px solid ${hasOpenComment ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: hasOpenComment ? 'var(--color-primary-muted)' : 'var(--color-surface-elevated)',
                        cursor: 'pointer',
                        fontSize: 'var(--text-caption)',
                        color: hasOpenComment ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      }}
                    >
                      Kommentera {inlineComments.length > 0 && <span>· {inlineComments.length}</span>}
                    </button>
                  </div>

                  {isReactionPickerOpen && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-xs)',
                        marginTop: 'var(--space-xs)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 'var(--space-xs)',
                      }}>
                        {QUICK_REACTIONS.map((emoji) => {
                          const reactors = itemReactions[emoji] ?? [];
                          const hasReacted = S.me ? reactors.includes(S.me) : false;
                          return (
                            <button
                              key={emoji}
                              onClick={() => {
                                void handleToggleReaction(item, emoji);
                                closeReactionPicker(itemId);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
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
                            void handleToggleWitness(item);
                            closeReactionPicker(itemId);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-pill)',
                            border: `1px solid ${(item.witnesses ?? []).includes(S.me!) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            background: (item.witnesses ?? []).includes(S.me!) ? 'var(--color-primary-muted)' : 'var(--color-surface-elevated)',
                            cursor: 'pointer',
                            fontSize: 'var(--text-caption)',
                            color: (item.witnesses ?? []).includes(S.me!) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          }}
                        >
                          <Radio size={12} strokeWidth={1.9} />
                          Var där {witnessCount > 0 && <span>{witnessCount}</span>}
                        </button>
                        <button
                          onClick={() => {
                            setCustomReactionInputId((current) => current === itemId ? null : itemId);
                            window.setTimeout(() => {
                              customReactionInputRefs.current[itemId]?.focus();
                            }, 40);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-pill)',
                            border: `1px solid ${isCustomReactionInputOpen ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            background: isCustomReactionInputOpen ? 'var(--color-primary-muted)' : 'var(--color-surface-elevated)',
                            cursor: 'pointer',
                            fontSize: 'var(--text-caption)',
                            color: isCustomReactionInputOpen ? 'var(--color-primary)' : 'var(--color-text-muted)',
                          }}
                        >
                          Egen emoji
                        </button>
                      </div>

                      {isCustomReactionInputOpen && (
                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                          <input
                            ref={(node) => {
                              customReactionInputRefs.current[itemId] = node;
                            }}
                            type="text"
                            inputMode="text"
                            maxLength={8}
                            value={customReactionDraft}
                            onChange={(e) => setCustomReactionDrafts((prev) => ({ ...prev, [itemId]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleSubmitCustomReaction(item);
                              }
                            }}
                            placeholder="😀"
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
                            onClick={() => { void handleSubmitCustomReaction(item); }}
                            disabled={!canSubmitCustomReaction}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-pill)',
                              border: 'none',
                              background: canSubmitCustomReaction ? 'var(--color-primary)' : 'var(--color-border)',
                              color: canSubmitCustomReaction ? '#fff' : 'var(--color-text-muted)',
                              cursor: canSubmitCustomReaction ? 'pointer' : 'not-allowed',
                              fontSize: 'var(--text-caption)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Lägg till
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {renderCommentComposer(item)}
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
