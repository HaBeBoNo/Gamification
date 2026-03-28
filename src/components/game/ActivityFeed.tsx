import React from 'react';
import { S, useGameStore } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { ScrollText, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

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

// ── Framer Motion ─────────────────────────────────────────────────
const itemVariants = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
};

// ── Komponent ─────────────────────────────────────────────────────
function ActivityFeed() {
  useGameStore((s: any) => s.tick); // prenumerera på store-uppdateringar
  const feed = S.feed || [];

  // console.log('feed item:', feed[0]); // STEG 1 diagnostik

  // ── Bandstatus ─────────────────────────────────────────────────
  // Obs: feed-objekten saknar numeriskt timestamp — vi räknar alla i feeden
  const activeMemberKeys = [...new Set(
    feed
      .map((e: any) => e.who || e.memberKey || e.member_key)
      .filter(Boolean)
  )];
  const weeklyXP = feed.reduce((sum: number, e: any) => {
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
      <div className="panel-header">
        <div className="panel-title">
          <ScrollText size={14} strokeWidth={2} />
          AKTIVITET
        </div>
      </div>

      {/* ── Bandstatus-rad ─────────────────────────────────────── */}
      {feed.length > 0 && (
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
      {feed.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-xl) var(--space-lg)' }}>
          <Activity size={48} strokeWidth={1} />
          <div className="empty-text">Ingen aktivitet ännu. Första steget är ditt.</div>
        </div>
      ) : (
        <div className="feed-list feed-list-flat">
          {feed.map((item: any, i: number) => {

            // ── Synergy-kort ──────────────────────────────────────
            if (isSynergy(item)) {
              const members = parseSynergyMembers(item);
              const mA = members ? (MEMBERS as any)[members[0]] : null;
              const mB = members ? (MEMBERS as any)[members[1]] : null;
              const ts = item.ts || item.time || item.t || '';
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
                  <div className="feed-synergy-ts">{timeAgo(ts as any)}</div>
                </motion.div>
              );
            }

            // ── Standard feed-rad ─────────────────────────────────
            const member   = (MEMBERS as any)[item.who] || null;
            const icon     = getEventIcon(item);
            // BUG-FIX: texten ligger i item.action, INTE item.text
            const actionText = item.action || '';
            // XP: explicit fält eller extraherat ur action-text
            const xp         = item.xp || extractXPFromText(actionText) || 0;
            // Timestamp: item.ts (useXP.js) eller item.time (övriga)
            const ts         = item.ts || item.time || item.t || '';

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
                  {member?.emoji || icon}
                </div>

                {/* Mitten: text */}
                <div className="feed-content">
                  <span className="feed-name">{member?.name || item.who || '?'}</span>
                  <span className="feed-action"> {displayAction}</span>
                  {questTitle && (
                    <span className="feed-quest"> "{questTitle}"</span>
                  )}
                </div>

                {/* Höger: XP + tid */}
                <div className="feed-meta">
                  {xp > 0 && <span className="feed-xp">+{xp} XP</span>}
                  <span className="feed-time">{timeAgo(ts as any)}</span>
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
