import React, { useState, useEffect, useMemo, useRef } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { ScrollText, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { sendPush } from '@/lib/sendPush';

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

function getMemberName(memberKey?: string): string {
  if (!memberKey) return 'Någon';
  return (MEMBERS as Record<string, { name?: string }>)[memberKey]?.name || memberKey;
}

function getMemberKeyByName(name?: string): string | null {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  const entry = Object.entries(MEMBERS).find(([, member]) => member.name?.toLowerCase() === normalized);
  return entry?.[0] || null;
}

interface ParsedCommentAction {
  targetName: string;
  targetKey: string | null;
  contextLabel: string;
  comment: string;
}

function parseCommentAction(action?: string): ParsedCommentAction | null {
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
    targetKey: getMemberKeyByName(String(targetEntry)),
    contextLabel: match[2] || 'aktivitet',
    comment: match[3] || '',
  };
}

function isCommentItem(item: any): boolean {
  return Boolean(parseCommentAction(item?.action));
}

function getFeedContextLabel(item: any): string {
  if (!item?.action) return 'aktivitet';
  const quoted = item.action.match(/[""]([^""]+)[""]/);
  return quoted?.[1] || 'aktivitet';
}

function buildFeedPresentation(feedItems: any[]) {
  const commentsByItemId = new Map<string, Array<any>>();
  const hiddenCommentIds = new Set<string>();
  const pendingSpecific = new Map<string, Array<any>>();
  const pendingGeneric = new Map<string, Array<any>>();

  feedItems.forEach((item) => {
    const parsed = parseCommentAction(item.action);
    const itemId = String(item.id || '');

    if (parsed) {
      const enriched = { ...item, parsedComment: parsed };
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

// ── Komponent ─────────────────────────────────────────────────────
function ActivityFeed({ hideHeader }: { hideHeader?: boolean }) {
  // feedItems hämtas direkt från Supabase för stabila UUID:n (reaktioner kräver item.id)
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const presentation = useMemo(() => buildFeedPresentation(feedItems), [feedItems]);

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

    const { error } = await supabase
      .from('activity_feed')
      .update({ reactions: newReactions })
      .eq('id', item.id);

    if (error) {
      console.warn('toggleReaction failed:', error.message);
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

    const { error } = await supabase
      .from('activity_feed')
      .update({ witnesses: updated })
      .eq('id', item.id);

    if (error) {
      console.warn('toggleWitness failed:', error.message);
    }
  }

  async function handleSubmitComment(item: any) {
    const me = S.me;
    if (!me) return;

    const rawDraft = commentDrafts[item.id] ?? '';
    const comment = rawDraft.trim();
    if (!comment) return;

    const targetName = getMemberName(item.who);
    const itemLabel = (item.action || '').includes('"')
      ? (item.action.match(/[""]([^""]+)[""]/)?.[1] || 'aktivitet')
      : 'aktivitet';
    const action = `kommenterade ${targetName}s ${itemLabel === 'aktivitet' ? 'aktivitet' : `"${itemLabel}"`}: "${comment}"`;
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

    setSubmittingCommentId(item.id);
    setOpenCommentId(null);
    setCommentDrafts(prev => ({ ...prev, [item.id]: '' }));
    setFeedItems(prev => mergeIncomingFeedItem(prev, optimisticItem));

    if (item.who && item.who !== me) {
      const commenterName = getMemberName(me);
      void sendPush(
        `${commenterName} kommenterade din aktivitet`,
        comment.length > 80 ? `${comment.slice(0, 77)}...` : comment,
        me,
        '/'
      );
    }

    if (!supabase) {
      setSubmittingCommentId(null);
      return;
    }

    const { data, error } = await supabase
      .from('activity_feed')
      .insert({
        who: me,
        action,
        xp: 0,
        created_at: createdAt,
      })
      .select('*')
      .single();

    if (error) {
      console.warn('create comment activity failed:', error.message);
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
      const { data, error } = await supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      console.log('[ActivityFeed] data:', data?.length, 'error:', error);
      if (data) setFeedItems(data);
      setLoading(false);
    }

    loadFeed();

    const channel = supabase
      .channel('activity-feed-global')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_feed',
      }, payload => {
        setFeedItems(prev => mergeIncomingFeedItem(prev, payload.new as any));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'activity_feed',
      }, payload => {
        setFeedItems(prev =>
          prev.map(item => item.id === (payload.new as any).id ? payload.new as any : item)
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [S.me]);

  // ── Bandstatus ─────────────────────────────────────────────────
  const activeMemberKeys = [...new Set(
    feedItems
      .map((e: any) => e.who || e.memberKey || e.member_key)
      .filter(Boolean)
  )];
  const weeklyXP = feedItems.reduce((sum: number, e: any) => {
    const explicit = e.xp || 0;
    // useXP.js bäddar in XP i action-texten istället för ett separat fält
    const fromText = explicit === 0 ? (extractXPFromText(e.action || '') ?? 0) : 0;
    return sum + explicit + fromText;
  }, 0);

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

  // ── Render ─────────────────────────────────────────────────────
  return (
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
      {feedItems.length > 0 && (
        <div className="feed-band-status">
          <span>⚡ {activeMemberKeys.length} members aktiva denna vecka</span>
          {weeklyXP > 0 && (
            <>
              <span className="feed-band-sep"> · </span>
              <span className="feed-band-xp">{weeklyXP} XP totalt</span>
            </>
          )}
        </div>
      )}

      {/* ── Tom state / loading ────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
          <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>Laddar...</span>
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
            const parsedComment = parseCommentAction(item.action);
            const inlineComments = presentation.commentsByItemId.get(itemId) || [];
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
            const commentDraft = commentDrafts[item.id] ?? '';
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
                          {inlineComments.slice(0, 3).map((commentItem: any) => {
                            const commenter = (MEMBERS as any)[commentItem.who] || null;
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
                                  gap: 6,
                                }}>
                                  <span>{commenter?.name || commentItem.who}</span>
                                  <span>sa:</span>
                                </div>
                                <div style={{
                                  fontSize: 'var(--text-caption)',
                                  color: 'var(--color-text)',
                                  lineHeight: 1.5,
                                }}>
                                  {commentItem.parsedComment?.comment || ''}
                                </div>
                              </div>
                            );
                          })}
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
                      onClick={() => setOpenCommentId(hasOpenComment ? null : item.id)}
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
                  </div>

                  {hasOpenComment && (
                    <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
                      <input
                        type="text"
                        maxLength={160}
                        value={commentDraft}
                        onChange={(e) => setCommentDrafts(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder={`Svara ${getMemberName(item.who).split(' ')[0]}...`}
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
                        disabled={!commentDraft.trim() || submittingCommentId === item.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-pill)',
                          border: 'none',
                          background: commentDraft.trim() ? 'var(--color-primary)' : 'var(--color-border)',
                          color: commentDraft.trim() ? '#fff' : 'var(--color-text-muted)',
                          cursor: commentDraft.trim() ? 'pointer' : 'not-allowed',
                          fontSize: 'var(--text-caption)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {submittingCommentId === item.id ? '...' : 'Skicka'}
                      </button>
                    </div>
                  )}

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
  );
}

export default React.memo(ActivityFeed);
