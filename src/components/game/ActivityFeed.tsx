import React, { useState, useEffect } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { ScrollText, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

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

// ── Reaktionsfunktion ─────────────────────────────────────────────
async function toggleReaction(
  feedId: string | undefined,
  emoji: string,
  currentReactions: Record<string, string[]>
) {
  if (!feedId || !supabase) return;
  const me = S.me;
  if (!me) return;

  const existing = currentReactions[emoji] ?? [];
  const hasReacted = existing.includes(me);
  const updated = hasReacted
    ? existing.filter((k: string) => k !== me)
    : [...existing, me];

  const newReactions = { ...currentReactions, [emoji]: updated };
  if (newReactions[emoji].length === 0) delete newReactions[emoji];

  await supabase
    .from('activity_feed')
    .update({ reactions: newReactions })
    .eq('id', feedId);
}

// ── Witness-funktion ──────────────────────────────────────────────
async function toggleWitness(feedId: string, currentWitnesses: string[]) {
  const me = S.me;
  if (!me || !supabase) return;

  const hasWitnessed = currentWitnesses.includes(me);
  const updated = hasWitnessed
    ? currentWitnesses.filter(k => k !== me)
    : [...currentWitnesses, me];

  await supabase
    .from('activity_feed')
    .update({ witnesses: updated })
    .eq('id', feedId);
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

  // Vid mount: hämta de 50 senaste posterna + prenumerera på Realtime INSERT/UPDATE
  useEffect(() => {
    async function loadFeed() {
      const { data } = await supabase
        .from('activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setFeedItems(data);
    }

    loadFeed();

    const channel = supabase
      .channel('activity-feed-global')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_feed',
      }, payload => {
        setFeedItems(prev => [payload.new as any, ...prev].slice(0, 50));
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
  }, []);

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

      {/* ── Tom state ──────────────────────────────────────────── */}
      {feedItems.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-xl) var(--space-lg)' }}>
          <Activity size={48} strokeWidth={1} />
          <div className="empty-text">Ingen aktivitet ännu. Första steget är ditt.</div>
        </div>
      ) : (
        <div className="feed-list feed-list-flat">
          {feedItems.map((item: any, i: number) => {

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

            return (
              <motion.div
                key={i}
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

                  {/* ── Reaktionsknappar ───────────────────────── */}
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-xs)' }}>
                    {(['🔥', '👏', '💀'] as const).map(emoji => {
                      const reactors = itemReactions[emoji] ?? [];
                      const hasReacted = S.me ? reactors.includes(S.me) : false;
                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(item.id, emoji, itemReactions)}
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
                  </div>

                  {/* ── Witness-rad (för item.xp >= 50) ────────────────── */}
                  {(item.xp ?? 0) >= 50 && (
                    <div style={{ marginTop: 'var(--space-xs)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <button
                        onClick={() => toggleWitness(item.id, item.witnesses ?? [])}
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
                          {item.witnesses.join(', ')}
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
