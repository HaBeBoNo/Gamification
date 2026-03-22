import React, { useState, useMemo, useEffect } from 'react';
import { S, notify } from '@/state/store';
import { MEMBERS, ROLE_TYPE_LABEL } from '@/data/members';
import { Trophy, Flame, Zap, Check } from 'lucide-react';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion, AnimatePresence } from 'framer-motion';
import ActivityHeatmap from './ActivityHeatmap';
import MemberStatusDot from './MemberStatusDot';
import { supabase } from '@/lib/supabase';

type SortKey = 'xp' | 'week' | 'streak';

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
  role: string;
  roleType: string;
  xpColor: string;
  totalXp: number;
  streak: number;
  weekCount: number;
  synergyCount: number;
  formDots: boolean[];
}

const SORT_PILLS: { key: SortKey; label: string }[] = [
  { key: 'xp', label: 'XP' },
  { key: 'week', label: 'Vecka' },
  { key: 'streak', label: 'Streak' },
];

export default function LeaderboardView() {
  const [sortKey, setSortKey] = useState<SortKey>('xp');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate(n => n + 1);
  const [loadingData, setLoadingData] = useState(true);

  // Realtime — hämta alla members vid mount + lyssna på live-ändringar
  useEffect(() => {
    if (!supabase) return;

    // Hämta alla members data vid mount
    async function fetchAllMembers() {
      setLoadingData(true);
      const { data } = await supabase
        .from('member_data')
        .select('member_key, data');

      if (data) {
        data.forEach(row => {
          if (row.member_key !== S.me && row.data?.chars?.[row.member_key]) {
            S.chars[row.member_key] = {
              ...S.chars[row.member_key],
              ...row.data.chars[row.member_key],
            };
          }
        });
      }
      setLoadingData(false);
    }

    fetchAllMembers();

    // Lyssna på realtidsändringar
    const channel = supabase
      .channel('leaderboard_realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'member_data',
        },
        (payload) => {
          const remote = payload.new as any;
          if (remote?.member_key && remote.member_key !== S.me) {
            const remoteChars = remote.data?.chars;
            if (remoteChars?.[remote.member_key]) {
              S.chars[remote.member_key] = {
                ...S.chars[remote.member_key],
                ...remoteChars[remote.member_key],
              };
              // Trigga re-render
              notify();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const rows: MemberRow[] = useMemo(() => {
    return Object.entries(S.chars)
      .map(([id, char]) => {
        const member = MEMBERS[id];
        if (!member) return null;
        return {
          id,
          name: member.name,
          role: member.role,
          roleType: member.roleType,
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
    const compare = (a: MemberRow, b: MemberRow) => {
      switch (sortKey) {
        case 'week': return b.weekCount - a.weekCount || b.totalXp - a.totalXp;
        case 'streak': return b.streak - a.streak || b.totalXp - a.totalXp;
        case 'xp': default: return b.totalXp - a.totalXp;
      }
    };
    return [...rows].sort(compare).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, sortKey]);

  if (loadingData) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 48,
        color: 'var(--color-text-muted)',
        fontSize: 13, fontFamily: 'var(--font-ui)',
      }}>
        Hämtar leaderboard...
      </div>
    );
  }

  return (
    <div className="lbv">
      {/* Header with sort pills right-aligned */}
      <div className="lbv-header">
        <h1 className="lbv-title">Leaderboard</h1>
        <div className="lbv-pills">
          {SORT_PILLS.map(pill => (
            <button
              key={pill.key}
              className={`lbv-pill ${sortKey === pill.key ? 'active' : ''}`}
              onClick={() => setSortKey(pill.key)}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="lbv-empty">
          <Trophy size={48} strokeWidth={1} />
          <div className="lbv-empty-text">Ingen aktivitet ännu — första uppdraget avgör allt.</div>
        </div>
      ) : (
        <div className="lbv-rows">
          {sorted.map((row, i) => {
            const isMe = S.me === row.id;
            const isExpanded = expandedId === row.id;
            const recentQuests = getRecentCompletions(row.id);
            const roleInfo = ROLE_TYPE_LABEL[row.roleType];

            return (
              <motion.div
                key={row.id}
                layout
                transition={cardSpring}
                className={`lbv-row ${isMe ? 'lbv-row-me' : ''} ${i % 2 === 0 ? 'lbv-row-even' : 'lbv-row-odd'} ${isExpanded ? 'lbv-row-expanded' : ''}`}
                style={isMe ? { '--lbv-me-color': row.xpColor } as React.CSSProperties : undefined}
                onClick={() => setExpandedId(isExpanded ? null : row.id)}
              >
                <div className="lbv-row-main">
                  {/* Left cluster */}
                  <div className="lbv-left">
                    <span className="lbv-rank">{row.rank}</span>
                    <div className="lbv-avatar" style={{ position: 'relative' }}>
                      <MemberIcon id={row.id} size={28} color={row.xpColor} />
                      <MemberStatusDot memberId={row.id} size={28} />
                    </div>
                    <div className="lbv-info">
                      <span className="lbv-name">{row.name}</span>
                      <span className="lbv-role">{row.role}</span>
                      {roleInfo && (
                        <span className="lbv-role-type" style={{ color: roleInfo.color }}>
                          {roleInfo.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right cluster */}
                  <div className="lbv-right">
                    <div className="lbv-form-dots">
                      {row.formDots.map((filled, di) => (
                        <span
                          key={di}
                          className={`lt-form-dot ${filled ? 'filled' : ''}`}
                          style={filled ? { background: row.xpColor } : undefined}
                        />
                      ))}
                    </div>
                    <div className={`lbv-streak-cell streak-tier-${row.streak >= 14 ? 'max' : row.streak >= 7 ? 'high' : row.streak >= 3 ? 'mid' : row.streak > 0 ? 'low' : 'zero'}`}> 
                      <Flame size={16} />
                      <span className="lt-streak-val">{row.streak}</span>
                    </div>
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
                        <div className="lt-expanded-extra-stats">
                          <span className="lt-expanded-label">Denna vecka:</span>
                          <span className={`lt-week-val ${row.weekCount >= 3 ? 'hot' : row.weekCount >= 1 ? 'warm' : ''}`}> 
                            {row.weekCount} uppdrag
                          </span>
                          <span className="lt-expanded-label" style={{ marginLeft: 'var(--space-lg)' }}>Synergi:</span>
                          <span className="lt-synergy-val">
                            {row.synergyCount > 0 && <Zap size={10} className="lt-synergy-icon" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />}
                            {row.synergyCount}
                          </span>
                        </div>

                        <div className="lt-expanded-heatmap">
                          <ActivityHeatmap
                            memberId={row.id}
                            xpColor={row.xpColor}
                            compact={true}
                          />
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
      )}
    </div>
  );
}