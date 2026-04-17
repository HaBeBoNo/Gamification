import React, { useState, useMemo, useEffect } from 'react';
import { S, save } from '@/state/store';
import { MEMBERS, ROLE_TYPE_LABEL } from '@/data/members';
import { Trophy, Flame, Zap, Check, Star } from 'lucide-react';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion, AnimatePresence } from 'framer-motion';
import ActivityHeatmap from './ActivityHeatmap';
import MemberStatusDot from './MemberStatusDot';
import { supabase } from '@/lib/supabase';
import { fireAndForget } from '@/lib/async';
import { wasQuestCompletedByMember } from '@/lib/questUtils';

type SortKey = 'xp' | 'week' | 'streak';

const cardSpring = { type: 'spring' as const, stiffness: 300, damping: 35 };

function getMemberCharFromData(memberId: string, memberDataMap: Record<string, any>) {
  return memberDataMap[memberId]?.chars?.[memberId] || S.chars[memberId] || null;
}

function getCompletedQuestHistory(char: any): any[] {
  const completedQuests = Array.isArray(char?.completedQuests) ? char.completedQuests : [];
  return [...completedQuests]
    .filter((entry: any) => entry?.completedAt)
    .sort((a: any, b: any) => Number(b.completedAt || 0) - Number(a.completedAt || 0));
}

function getWeekCompletionsFromChar(char: any): number {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return getCompletedQuestHistory(char).filter((entry: any) => Number(entry.completedAt || 0) > weekAgo).length;
}

function getSynergyCount(memberId: string): number {
  return (S.quests || []).filter(
    (q: any) => wasQuestCompletedByMember(q, memberId) && q.synergyTrigger
  ).length;
}

function getFormDotsFromChar(char: any): boolean[] {
  const completed = getCompletedQuestHistory(char).slice(0, 5);
  const dots: boolean[] = [];
  for (let i = 0; i < 5; i++) {
    dots.push(i < completed.length);
  }
  return dots;
}

function getRecentCompletionsFromChar(char: any): string[] {
  return getCompletedQuestHistory(char)
    .slice(0, 3)
    .map((entry: any) => String(entry.title || ''))
    .filter(Boolean);
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

let leaderboardMemberDataCache: Record<string, any> = {};
let leaderboardEndorsementsCache: Record<string, Record<string, string[]>> = {};
let leaderboardRemoteHydrated = false;

function isActiveTodayFromChar(char: any): boolean {
  const today = new Date().toDateString();
  const lastSeen = Number(char?.lastSeen || char?.lastQuestDate || 0);
  if (lastSeen && new Date(lastSeen).toDateString() === today) return true;

  return getCompletedQuestHistory(char).some((entry: any) => {
    const completedAt = Number(entry?.completedAt || 0);
    return completedAt > 0 && new Date(completedAt).toDateString() === today;
  });
}

function LeaderboardView() {
  const [sortKey, setSortKey] = useState<SortKey>('xp');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(() => !leaderboardRemoteHydrated);
  const [memberDataMap, setMemberDataMap] = useState<Record<string, any>>(() => leaderboardMemberDataCache);
  const [endorsementsMap, setEndorsementsMap] = useState<Record<string, Record<string, string[]>>>(() => leaderboardEndorsementsCache);

  useEffect(() => {
    if (!supabase) {
      setLoadingData(false);
      return;
    }

    let cancelled = false;

    async function fetchAllMembers() {
      if (!leaderboardRemoteHydrated) {
        setLoadingData(true);
      }
      const { data } = await supabase
        .from('member_data')
        .select('member_key, data');

      if (cancelled) return;

      if (data) {
        const dataMap: Record<string, any> = {};
        const nextEndorsementsMap: Record<string, Record<string, string[]>> = {};
        let mergedRemoteChars = false;

        data.forEach((row) => {
          if (row.data?.chars?.[row.member_key]) {
            S.chars[row.member_key] = {
              ...S.chars[row.member_key],
              ...row.data.chars[row.member_key],
            };
            mergedRemoteChars = true;
          }

          dataMap[row.member_key] = row.data;
          nextEndorsementsMap[row.member_key] = row.data?.endorsements ?? {};
        });

        if (mergedRemoteChars) {
          save();
        }

        leaderboardMemberDataCache = dataMap;
        leaderboardEndorsementsCache = nextEndorsementsMap;
        leaderboardRemoteHydrated = true;
        setMemberDataMap(dataMap);
        setEndorsementsMap(nextEndorsementsMap);
      }

      setLoadingData(false);
    }

    fireAndForget(fetchAllMembers(), 'load leaderboard member data');

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
          if (remote?.member_key) {
            const remoteChars = remote.data?.chars;
            let mergedRemoteChars = false;
            if (remoteChars?.[remote.member_key]) {
              S.chars[remote.member_key] = {
                ...S.chars[remote.member_key],
                ...remoteChars[remote.member_key],
              };
              mergedRemoteChars = true;
            }

            const nextMemberDataMap = {
              ...leaderboardMemberDataCache,
              [remote.member_key]: remote.data,
            };
            const nextEndorsementsMap = {
              ...leaderboardEndorsementsCache,
              [remote.member_key]: remote.data?.endorsements ?? {},
            };

            leaderboardMemberDataCache = nextMemberDataMap;
            leaderboardEndorsementsCache = nextEndorsementsMap;
            leaderboardRemoteHydrated = true;
            setMemberDataMap(nextMemberDataMap);
            setEndorsementsMap(nextEndorsementsMap);

            if (mergedRemoteChars) {
              save();
            }
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  async function giveEndorsement(targetKey: string, stat: string) {
    const me = S.me;
    if (!me || me === targetKey) return;
    const current = endorsementsMap[targetKey] ?? {};
    const endorsers = current[stat] ?? [];
    if (endorsers.includes(me)) return;

    const updated = { ...current, [stat]: [...endorsers, me] };

    // Hämta befintlig data-blob för att inte skriva över den
    const { data: existing } = await supabase
      .from('member_data')
      .select('data')
      .eq('member_key', targetKey)
      .single();

    await supabase
      .from('member_data')
      .update({ data: { ...(existing?.data ?? {}), endorsements: updated } })
      .eq('member_key', targetKey);

    const nextEndorsementsMap = { ...endorsementsMap, [targetKey]: updated };
    leaderboardEndorsementsCache = nextEndorsementsMap;
    setEndorsementsMap(nextEndorsementsMap);
  }

  const rows: MemberRow[] = Object.entries(S.chars)
      .map(([id]) => {
        const member = MEMBERS[id];
        if (!member) return null;
        const char = getMemberCharFromData(id, memberDataMap);
        return {
          id,
          name: member.name,
          role: member.role,
          roleType: member.roleType,
          xpColor: member.xpColor,
          totalXp: char?.totalXp || 0,
          streak: char?.streak || 0,
          weekCount: getWeekCompletionsFromChar(char),
          synergyCount: getSynergyCount(id),
          formDots: getFormDotsFromChar(char),
        };
      })
      .filter(Boolean) as MemberRow[];

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

  if (loadingData && sorted.length === 0) {
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
      <div className="lbv-header">
        <h1 className="lbv-title">Leaderboard</h1>
        <div className="lbv-pills">
          {SORT_PILLS.map(pill => (
            <button type="button"
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
          <div className="lbv-empty-text">Ingen ranking ännu.</div>
        </div>
      ) : (
        <div className="lbv-rows">
          {sorted.map((row, i) => {
            const isMe = S.me === row.id;
            const isExpanded = expandedId === row.id;
            const memberChar = getMemberCharFromData(row.id, memberDataMap);
            const recentQuests = getRecentCompletionsFromChar(memberChar);
            const roleInfo = ROLE_TYPE_LABEL[row.roleType];
            const char = memberChar;
            const questsDone = char?.questsDone || getCompletedQuestHistory(char).length || 0;
            const streak = char?.streak || 0;
            const longestStreak = (char?.longestStreak || streak) as number;
            const weeklyQuests = getWeekCompletionsFromChar(char);
            const hasActivity = getCompletedQuestHistory(char).length > 0;

            return (
              <motion.div
                key={row.id}
                layout
                transition={cardSpring}
                className={`lbv-row ${isMe ? 'lbv-row-me' : ''} ${i % 2 === 0 ? 'lbv-row-even' : 'lbv-row-odd'} ${isExpanded ? 'lbv-row-expanded' : ''}`} 
                style={isMe ? { '--lbv-me-color': row.xpColor } as React.CSSProperties : undefined}
              >
                <div className="lbv-row-main" onClick={() => setExpandedId(isExpanded ? null : row.id)}>
                  <div className="lbv-left">
                    <span className="lbv-rank">{row.rank}</span>
                    <div className="lbv-avatar" style={{ position: 'relative' }}>
                      <MemberIcon id={row.id} size={28} color={row.xpColor} />
                      <MemberStatusDot memberId={row.id} size={28} />
                      {isActiveTodayFromChar(memberChar) && (
                        <span style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: 'var(--color-accent)',
                          border: '2px solid var(--color-surface)',
                          pointerEvents: 'none',
                        }} />
                      )}
                    </div>
                    <div className="lbv-info">
                      <span className="lbv-name">
                        {memberDataMap[row.id]?.mvp_badge && (
                          <span style={{ fontSize: 14, marginRight: 4 }} title="Veckans MVP">👑</span>
                        )}
                        {row.name}
                      </span>
                      <span className="lbv-role">{row.role}</span>
                      {roleInfo && (
                        <span className="lbv-role-type" style={{ color: roleInfo.color }}>
                          {roleInfo.label}
                        </span>
                      )}
                    </div>
                  </div>

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
                    <div className={`lbv-streak-cell streak-tier-${streak >= 14 ? 'max' : streak >= 7 ? 'high' : streak >= 3 ? 'mid' : streak > 0 ? 'low' : 'zero'}`}> 
                      <Flame size={16} />
                      <span className="lt-streak-val">{streak}</span>
                    </div>
                    <span className="lt-xp-val">{row.totalXp}</span>
                  </div>
                </div>

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
                          <span className={`lt-week-val ${weeklyQuests >= 3 ? 'hot' : weeklyQuests >= 1 ? 'warm' : ''}`}> 
                            {weeklyQuests} uppdrag
                          </span>
                          <span className="lt-expanded-label" style={{ marginLeft: 'var(--space-lg)' }}>Streak:</span>
                          <span className="lt-streak-val">{streak}</span>
                          <span className="lt-expanded-label" style={{ marginLeft: 'var(--space-lg)' }}>Längsta:</span>
                          <span className="lt-streak-val">{longestStreak}</span>
                          <span className="lt-expanded-label" style={{ marginLeft: 'var(--space-lg)' }}>Klara uppdrag:</span>
                          <span className="lt-streak-val">{questsDone}</span>
                          <span className="lt-expanded-label" style={{ marginLeft: 'var(--space-lg)' }}>Synergi:</span>
                          <span className="lt-synergy-val">
                            {row.synergyCount > 0 && <Zap size={10} className="lt-synergy-icon" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />}
                            {row.synergyCount}
                          </span>
                        </div>

                        {hasActivity && (
                          <div className="lt-expanded-heatmap">
                            <ActivityHeatmap
                              memberId={row.id}
                              xpColor={row.xpColor}
                              compact={true}
                            />
                          </div>
                        )}

                        {recentQuests.length > 0 && (
                          <div className="lt-expanded-quests">
                            {recentQuests.map((title, qi) => (
                              <div key={qi} className="lt-expanded-quest">
                                <Check size={14} style={{ color: row.xpColor, flexShrink: 0 }} /> {title}
                              </div>
                            ))}
                          </div>
                        )}

                        {row.id !== S.me && (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            paddingTop: 6,
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontFamily: 'var(--font-mono)',
                              fontSize: 'var(--text-micro)',
                              color: 'var(--color-text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                            }}>
                              <Star size={12} />
                              Ge cred
                            </div>
                            <div style={{
                              display: 'flex',
                              gap: 'var(--space-sm)',
                              flexWrap: 'wrap',
                            }}>
                              {(['vit', 'wis', 'for', 'cha'] as const).map(stat => {
                                const labels: Record<string, string> = { vit: 'Vitality', wis: 'Wisdom', for: 'Fortitude', cha: 'Charisma' };
                                const endorsers = endorsementsMap[row.id]?.[stat] ?? [];
                                const hasEndorsed = endorsers.includes(S.me!);
                                return (
                                  <button type="button"
                                    key={stat}
                                    onClick={() => giveEndorsement(row.id, stat)}
                                    disabled={hasEndorsed}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      minHeight: 36,
                                      padding: '0 12px',
                                      borderRadius: 'var(--radius-pill)',
                                      border: `1px solid ${hasEndorsed ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                      background: hasEndorsed ? 'var(--color-primary-muted)' : 'var(--color-surface-elevated)',
                                      color: hasEndorsed ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                      fontSize: 'var(--text-caption)',
                                      cursor: hasEndorsed ? 'default' : 'pointer',
                                      touchAction: 'manipulation',
                                    }}
                                  >
                                    {labels[stat]}
                                    {endorsers.length > 0 && (
                                      <span style={{
                                        background: 'var(--color-primary)',
                                        color: 'var(--color-surface)',
                                        borderRadius: '999px',
                                        minWidth: 18,
                                        height: 18,
                                        padding: '0 5px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 10,
                                        fontFamily: 'var(--font-mono)',
                                      }}>
                                        {endorsers.length}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
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
export default React.memo(LeaderboardView);
