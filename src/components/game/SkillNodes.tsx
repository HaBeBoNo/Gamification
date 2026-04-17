import React, { useState } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isQuestDoneNow, isQuestRelevantToMember, wasQuestCompletedByMember } from '@/lib/questUtils';

const CATEGORIES = [
  { id: 'wisdom', label: 'WISDOM', color: 'var(--cat-wisdom)' },
  { id: 'tech', label: 'TECH', color: 'var(--cat-tech)' },
  { id: 'social', label: 'SOCIAL', color: 'var(--cat-social)' },
  { id: 'money', label: 'MONEY', color: 'var(--cat-money)' },
  { id: 'health', label: 'HEALTH', color: 'var(--cat-health)' },
  { id: 'global', label: 'GLOBAL', color: 'var(--cat-global)' },
];

const TOTAL_NODES = 6; // 1 + 2 + 3

function getCompletedCount(cat: string, memberId: string) {
  return (S.quests || []).filter(
    (q: any) => wasQuestCompletedByMember(q, memberId) && q.cat === cat
  ).length;
}

function getCategoryQuests(cat: string, memberId: string) {
  return (S.quests || []).filter(
    (q: any) => q.cat === cat && isQuestRelevantToMember(q, memberId)
  );
}

interface NodeGraphProps {
  filled: number;
  color: string;
  large?: boolean;
}

function NodeGraph({ filled, color, large }: NodeGraphProps) {
  const s = large ? 2 : 1;
  const nodeR = [12 * s, 9 * s, 7 * s]; // tier radii
  const gapY = large ? 32 : 18;
  const w = large ? 160 : 80;
  const h = large ? 120 : 64;

  // tier positions (bottom to top)
  const tiers = [
    [{ x: w / 2, y: h - nodeR[0] }], // tier 1: 1 node
    [{ x: w * 0.35, y: h - nodeR[0] * 2 - gapY }, { x: w * 0.65, y: h - nodeR[0] * 2 - gapY }], // tier 2: 2 nodes
    [{ x: w * 0.2, y: nodeR[2] + 2 }, { x: w * 0.5, y: nodeR[2] + 2 }, { x: w * 0.8, y: nodeR[2] + 2 }], // tier 3: 3 nodes
  ];

  const allNodes = [...tiers[0], ...tiers[1], ...tiers[2]];
  let nodeIndex = 0;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="sn-graph">
      {/* Lines: tier0→tier1, tier1→tier2 */}
      {tiers[0].map((from, fi) =>
        tiers[1].map((to, ti) => (
          <line
            key={`l0-${fi}-${ti}`}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke="var(--color-border)" strokeWidth={1}
            className={nodeIndex < filled ? 'sn-line-filled' : ''}
          />
        ))
      )}
      {tiers[1].map((from, fi) =>
        tiers[2].map((to, ti) => (
          <line
            key={`l1-${fi}-${ti}`}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke="var(--color-border)" strokeWidth={1}
          />
        ))
      )}
      {/* Nodes */}
      {tiers.map((tier, ti) =>
        tier.map((pos, ni) => {
          const idx = nodeIndex++;
          const isFilled = idx < filled;
          const isActive = idx === filled;
          const r = nodeR[ti];
          return (
            <g key={`n-${ti}-${ni}`}>
              <circle
                cx={pos.x} cy={pos.y} r={r}
                fill={isFilled ? color : 'var(--color-surface)'}
                stroke={isFilled ? 'none' : 'var(--color-border)'}
                strokeWidth={1.5}
                className={isActive ? 'sn-node-active' : ''}
                style={
                  isFilled
                    ? { filter: `drop-shadow(0 0 ${large ? 6 : 3}px ${color})` }
                    : isActive
                    ? { fill: color, opacity: 0.3 }
                    : undefined
                }
              />
            </g>
          );
        })
      )}
    </svg>
  );
}

export default function SkillNodes() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const me = S.me || '';
  const member = MEMBERS[me];

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        padding: '0 16px',
      }}>
        {CATEGORIES.map((cat, i) => {
          const count = getCompletedCount(cat.id, me);
          const filled = Math.min(count, TOTAL_NODES);
          return (
            <motion.button
              key={cat.id}
              className="sn-panel"
              onClick={() => setExpanded(cat.id)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.2 }}
              whileTap={{ scale: 0.97 }}
              style={{ maxHeight: 160, overflow: 'hidden' }}
            >
              <div className="sn-panel-header">
                <span className="sn-cat-dot" style={{ background: cat.color }} />
                <span className="sn-cat-label">{cat.label}</span>
              </div>
              <NodeGraph filled={filled} color={cat.color} />
              <div className="sn-panel-summary">
                <span className="sn-count">{filled}</span>
                <span className="sn-total"> / {TOTAL_NODES}</span>
              </div>
              <div className="sn-progress-track">
                <div
                  className="sn-progress-fill"
                  style={{ width: `${(filled / TOTAL_NODES) * 100}%`, background: cat.color }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="sn-expanded-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpanded(null)}
          >
            <motion.div
              className="sn-expanded-panel"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const cat = CATEGORIES.find(c => c.id === expanded)!;
                const count = getCompletedCount(cat.id, me);
                const filled = Math.min(count, TOTAL_NODES);
                const quests = getCategoryQuests(cat.id, me);
                return (
                  <>
                    <div className="sn-expanded-header">
                      <span className="sn-cat-dot" style={{ background: cat.color }} />
                      <span className="sn-expanded-title">{cat.label}</span>
                      <button type="button" className="sn-expanded-close" onClick={() => setExpanded(null)}>✕</button>
                    </div>
                    <div className="sn-expanded-graph">
                      <NodeGraph filled={filled} color={cat.color} large />
                    </div>
                    <div className="sn-expanded-count">
                      <span className="sn-count">{filled}</span>
                      <span className="sn-total"> / {TOTAL_NODES}</span>
                    </div>
                    <div className="sn-expanded-quests">
                      {quests.map((q: any) => (
                        <div key={q.id} className={`sn-quest-row ${isQuestDoneNow(q) ? 'done' : ''}`}>
                          <span className="sn-quest-check" style={isQuestDoneNow(q) ? { color: cat.color } : undefined}>
                            {isQuestDoneNow(q) ? <Check size={14} style={{ display: 'inline' }} /> : '○'}
                          </span>
                          <span className="sn-quest-title">{q.title}</span>
                        </div>
                      ))}
                      {quests.length === 0 && (
                        <div className="sn-quest-empty">Inga uppdrag i denna kategori.</div>
                      )}
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
