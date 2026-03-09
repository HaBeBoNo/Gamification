import React from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import {
  ScrollText, Activity, CheckCircle, TrendingUp, Zap,
  ArrowRightLeft, Check, Award, Lightbulb, Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const itemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
};

const synergyTransition = { type: 'spring' as const, stiffness: 200, damping: 25 };
const regularTransition = { type: 'spring' as const, stiffness: 300, damping: 30 };

type FeedItemType = 'quest_complete' | 'level_up' | 'synergy' | 'delegation_sent' | 'delegation_accepted' | 'badge' | 'idea' | 'retroactive';

function detectType(item: any): FeedItemType {
  const t = (item.text || '').toLowerCase();
  if (item.synergy || t.includes('[synk]')) return 'synergy';
  if (t.includes('nivå') || t.includes('level')) return 'level_up';
  if (t.includes('delegera') && t.includes('acceptera')) return 'delegation_accepted';
  if (t.includes('delegera') || t.includes('skickade')) return 'delegation_sent';
  if (t.includes('märke') || t.includes('badge')) return 'badge';
  if (t.includes('idé') || t.includes('idea')) return 'idea';
  if (t.includes('retroaktiv')) return 'retroactive';
  return 'quest_complete';
}

const ICON_MAP: Record<FeedItemType, React.ElementType> = {
  quest_complete: CheckCircle,
  level_up: TrendingUp,
  synergy: Zap,
  delegation_sent: ArrowRightLeft,
  delegation_accepted: Check,
  badge: Award,
  idea: Lightbulb,
  retroactive: Sparkles,
};

const ICON_CLASS_MAP: Record<FeedItemType, string> = {
  quest_complete: 'feed-icon-accent',
  level_up: 'feed-icon-accent',
  synergy: 'feed-icon-accent',
  delegation_sent: 'feed-icon-secondary',
  delegation_accepted: 'feed-icon-accent',
  badge: 'feed-icon-accent',
  idea: 'feed-icon-accent',
  retroactive: 'feed-icon-accent',
};

function extractXP(text: string): string | null {
  const match = text.match(/(\d+)\s*XP/i);
  return match ? match[1] : null;
}

function highlightMemberName(text: string): React.ReactNode {
  const memberNames = Object.values(MEMBERS).map(m => m.name);
  let result = text;
  // We'll do simple bold wrapping via spans
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  for (const name of memberNames) {
    const idx = remaining.indexOf(name);
    if (idx !== -1) {
      if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
      parts.push(<span key={key++} className="feed-member-name">{name}</span>);
      remaining = remaining.slice(idx + name.length);
    }
  }
  if (parts.length === 0) return text;
  if (remaining) parts.push(<span key={key++}>{remaining}</span>);
  return <>{parts}</>;
}

export default function ActivityFeed() {
  const feed = S.feed || [];

  function isSynergy(item: any) {
    return item.synergy || (item.text && item.text.includes('[synk]'));
  }

  function parseSynergyMembers(item: any): [string, string] | null {
    if (item.memberA && item.memberB) return [item.memberA, item.memberB];
    const ids = Object.keys(MEMBERS);
    const found = ids.filter(id => item.text?.toLowerCase().includes(MEMBERS[id].name.toLowerCase()));
    if (found.length >= 2) return [found[0], found[1]];
    return null;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ScrollText size={14} strokeWidth={2} />
          AKTIVITET
        </div>
      </div>
      {feed.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-xl) var(--space-lg)' }}>
          <Activity size={48} strokeWidth={1} />
          <div className="empty-text">Ingen aktivitet ännu. Första steget är ditt.</div>
        </div>
      ) : (
        <div className="feed-list feed-list-flat">
          {feed.map((item: any, i: number) => {
            if (isSynergy(item)) {
              const members = parseSynergyMembers(item);
              const mA = members ? MEMBERS[members[0]] : null;
              const mB = members ? MEMBERS[members[1]] : null;
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
                  transition={synergyTransition}
                >
                  <div className="feed-synergy-avatars">
                    {mA && (
                      <div className="feed-synergy-avatar" style={{ background: mA.xpColor }}>
                        {getInitials(mA.name)}
                      </div>
                    )}
                    <div className="feed-synergy-line" />
                    {mB && (
                      <div className="feed-synergy-avatar" style={{ background: mB.xpColor }}>
                        {getInitials(mB.name)}
                      </div>
                    )}
                  </div>
                  <div className="feed-synergy-text">
                    {item.text?.replace('[synk]', '').trim() || item.text}
                  </div>
                  <div className="feed-synergy-ts">{item.t}</div>
                </motion.div>
              );
            }

            const type = detectType(item);
            const Icon = ICON_MAP[type];
            const iconClass = ICON_CLASS_MAP[type];
            const xpVal = extractXP(item.text || '');

            return (
              <motion.div
                key={i}
                className="feed-row"
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                transition={regularTransition}
              >
                <span className={`feed-row-icon ${iconClass}`}>
                  <Icon size={16} strokeWidth={2} />
                </span>
                <span className="feed-row-text">
                  {highlightMemberName(item.text || '')}
                </span>
                {xpVal && <span className="feed-row-xp">{xpVal} XP</span>}
                <span className="feed-row-ts">{item.t}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
