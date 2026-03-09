import React, { useState, useMemo } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { Trophy, Flame, Zap, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion, AnimatePresence } from 'framer-motion';
import ActivityHeatmap from './ActivityHeatmap';
import MemberStatusDot from './MemberStatusDot';

type SortKey = 'rank' | 'name' | 'form' | 'streak' | 'xp';

const cardSpring = { type: 'spring' as const, stiffness: 300, damping: 35 };

function getWeekCompletions(memberId: string): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return (S.quests || []).filter(
    (q: any) => q.done && (q.owner === memberId || q.completedBy === memberId) && (q.completedAt || 0) > weekAgo
  ).length;
}

function getSynergyCount(memberId: string): number {
  return (S.quests || []).filter(
    (q: any) => q.done && q.synergyTrigger && (q.owner === memberId || q.completedBy === memberId)
  ).length;
}

function getFormDots(memberId: string): boolean[] {
  const completed = (S.quests || [])
    .filter((q: any) => q.done && (q.owner === memberId || q.completedBy === memberId))
    .slice(-5);
  const dots: boolean[] = [];
  for (let i = 0; i < 5; i++) {
    dots.push(i < completed.length);
  }
  return dots;
}

function getRecentCompletions(memberId: string): string[] {
  return (S.quests || [])
    .filter((q: any) => q.done && (q.owner === memberId || q.completedBy === memberId))
    .slice(-3)
    .map((q: any) => q.title);
}

interface MemberRow {
  id: string;
  name: string;
  xpColor: string;
  totalXp: number;
  streak: number;
  weekCount: number;
  synergyCount: number;
  formDots: boolean[];
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'rank', label: '#' },
  { key: 'name', label: 'MEDLEM' },
  { key: 'form', label: 'FORM' },
  { key: 'streak', label: 'STREAK' },
  { key: 'xp', label: 'XP' },
];

export default function Leaderboard() {
  const [sortKey, setSortKey] = useState<SortKey>('xp');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows: MemberRow[] = useMemo(() => {
    return Object.entries(S.chars)
      .map(([id, char]) => {
        const member = MEMBERS[id];
        if (!member) return null;
        return {
          id,
          name: member.name,
          xpColor: member.xpColor,
          totalXp: char.totalXp || 0,
          streak: char.streak || 0,
          weekCount: getWeekCompletions(id),
          synergyCount: getSynergyCount(id),
          formDots: getFormDots(id),
        };
      })
      .filter(Boolean) as MemberRow[];
  }, []);

  const sorted = useMemo(() => {
    const byXp = [...rows].sort((a, b) => b.totalXp - a.totalXp);
    const withRank = byXp.map((r, i) => ({ ...r, rank: i + 1 }));

    const compare = (a: typeof withRank[0], b: typeof withRank[0]) => {
      let va: number | string, vb: number | string;
      switch (sortKey) {
        case 'rank': va = a.rank; vb = b.rank; break;
        case 'name': va = a.name; vb = b.name; break;
        case 'form': va = a.formDots.filter(Boolean).length; vb = b.formDots.filter(Boolean).length; break;
        case 'streak': va = a.streak; vb = b.streak; break;
        case 'xp': default: va = a.totalXp; vb = b.totalXp; break;
      }
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    };

    return [...withRank].sort(compare);
  }, [rows, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <Trophy size={14} strokeWidth={2} />
          LEADERBOARD
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <Trophy size={48} strokeWidth={1} />
          <div className="empty-text">Ingen data ännu. Slutför ett uppdrag!</div>
        </div>
      ) : (
        <div className="lt-wrapper lt-compact">
          {/* Table header */}
          <div className="lt-head">
            {COLUMNS.map(col => (
              <button
                key={col.key}
                className={`lt-th lt-col-${col.key} ${sortKey === col.key ? 'active' : ''}`}
                onClick={() => handleSort(col.key)}
              >
                <span>{col.label}</span>
                {sortKey === col.key && (
                  <span className="lt-sort-arrow">
                    {sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Table rows */}
          <div className="lt-body">
            {sorted.map((row, i) => {
              const isMe = S.me === row.id;
              const isExpanded = expandedId === row.id;
              const recentQuests = getRecentCompletions(row.id);

              return (
                <motion.div
                  key={row.id}
                  layout
                  transition={cardSpring}
                  className={`lt-row ${isMe ? 'lt-row-me' : ''} ${i % 2 === 1 ? 'lt-row-alt' : ''} ${isExpanded ? 'lt-row-expanded' : ''}`}
                  style={isMe ? { '--lt-me-color': row.xpColor } as React.CSSProperties : undefined}
                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                >
                  <div className="lt-row-main">
                    <div className="lt-cell lt-col-rank">
                      <span className="lt-rank-num">{row.rank}</span>
                    </div>

                    <div className="lt-cell lt-col-name">
                      <div className="lt-member-avatar" style={{ position: 'relative' }}>
                        <MemberIcon id={row.id} size={24} color={row.xpColor} />
                        <MemberStatusDot memberId={row.id} size={24} />
                      </div>
                      <span className="lt-member-name">{row.name}</span>
                    </div>

                    <div className="lt-cell lt-col-form">
                      <div className="lt-form-dots">
                        {row.formDots.map((filled, di) => (
                          <span
                            key={di}
                            className={`lt-form-dot ${filled ? 'filled' : ''}`}
                            style={filled ? { background: row.xpColor } : undefined}
                          />
                        ))}
                      </div>
                    </div>

                    <div className={`lt-cell lt-col-streak streak-tier-${row.streak >= 14 ? 'max' : row.streak >= 7 ? 'high' : row.streak >= 3 ? 'mid' : row.streak > 0 ? 'low' : 'zero'}`}>
                      <Flame size={16} />
                      <span className="lt-streak-val">{row.streak}</span>
                    </div>

                    <div className="lt-cell lt-col-xp">
                      <span className="lt-xp-val">{row.totalXp}</span>
                    </div>
                  </div>

                  {/* Expanded section */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        className="lt-expanded"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={cardSpring}
                      >
                        <div className="lt-expanded-inner">
                          <div className="lt-expanded-heatmap">
                            <ActivityHeatmap
                              memberId={row.id}
                              xpColor={row.xpColor}
                              compact={true}
                            />
                          </div>

                          {/* Vecka + Synergi shown in expanded */}
                          <div className="lt-expanded-extra-stats">
                            <span className="lt-expanded-label">Vecka:</span>
                            <span className={`lt-week-val ${row.weekCount >= 3 ? 'hot' : row.weekCount >= 1 ? 'warm' : ''}`}>
                              {row.weekCount} uppdrag
                            </span>
                            <span className="lt-expanded-label" style={{ marginLeft: 'var(--space-lg)' }}>Synergi:</span>
                            <span className="lt-synergy-val">
                              {row.synergyCount > 0 && <Zap size={10} className="lt-synergy-icon" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />}
                              {row.synergyCount}
                            </span>
                          </div>

                          {recentQuests.length > 0 && (
                            <div className="lt-expanded-quests">
                              {recentQuests.map((title, qi) => (
                                <div key={qi} className="lt-expanded-quest">
                                  <Check size={14} style={{ color: row.xpColor, flexShrink: 0 }} /> {title}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
