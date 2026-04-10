import React, { useState, useEffect } from 'react';
import { S, save } from '@/state/store';
import { MEMBERS, ROLE_TYPE_LABEL } from '@/data/members';
import { getRoleHidden } from '@/data/quests';
import QuestCard from './QuestCard';
import SortableQuestList from './SortableQuestList';
import DelegationInbox from './DelegationInbox';
import { showSidequestNudge, generatePersonalQuests, getDailyCoachMessage } from '@/hooks/useAI';
import { Compass, RefreshCw, Zap } from 'lucide-react';
import QuestCardSkeleton from './skeletons/QuestCardSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import CreateQuestModal from './CreateQuestModal';
import { fetchMyCollaborativeQuests, subscribeCollaborativeQuests } from '@/lib/collaborativeQuests'
import { supabase } from '@/lib/supabase';
import CollaborativeQuestCard from './CollaborativeQuestCard';
import type { CollaborativeQuest } from '@/lib/collaborativeQuests';
import { getQuestOrigin, isQuestDoneNow, refreshRecurringQuestStates } from '@/lib/questUtils';
import { getQuestFocusReason, getRelevantActiveQuests } from '@/lib/questFocus';

const SECTION_GAP = 'var(--section-gap)';
const SECTION_GAP_COMPACT = 'var(--section-gap-compact)';
const CARD_PAD = 'var(--card-padding)';
const CARD_PAD_ROOM = 'var(--card-padding-room)';
const CONTROL_HEIGHT = 'var(--control-height)';

const TABS = [
  { id: 'personal', label: 'MINA' },
  { id: 'daily', label: 'DAGLIGA' },
  { id: 'strategic', label: 'STRATEGISKA' },
  { id: 'hidden', label: 'DOLDA' },
  { id: 'sidequest', label: 'SIDEQUEST' },
  { id: 'all', label: 'ALLA' },
];

const FILTERS = [
  { id: 'alla',          label: 'Alla' },
  { id: 'generated',    label: 'Genererade' },
  { id: 'collaborative', label: 'Kollaborativa' },
  { id: 'personal',     label: 'Egenskapade' },
];

interface QuestGridProps {
  rerender: () => void;
  showLU: (level: number) => void;
  showRW: (reward: any, tier?: string) => void;
  showSidequestNudge?: (quests: any[]) => void;
  showXP?: (amount: number) => void;
  onQuestTap?: (quest: any) => void;
  onOpenCoach?: (initialMessage?: string) => void;
}

function getWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

function QuestGrid({ rerender, showLU, showRW, showSidequestNudge: onSidequestNudge, showXP, onOpenCoach }: QuestGridProps) {
  const [tab, setTab] = useState(S.tab || 'personal');
  const [filter, setFilter] = useState('alla');
  const [refreshing, setRefreshing] = useState(false);
  const [coachMessage, setCoachMessage] = useState('');
  const [showCreateQuest, setShowCreateQuest] = useState(false);
  const [collabQuests, setCollabQuests] = useState<CollaborativeQuest[]>([]);

  const me = S.me;
  const char = me ? S.chars[me] : null;
  const roleType = char?.roleType || MEMBERS[me!]?.roleType || 'amplifier';
  const cycleRefreshKey = new Date().toDateString();

  function getVisibleQuests() {
    const quests = S.quests || [];
    if (tab === 'all') return quests;
    if (tab === 'personal') {
      const allPersonalActive = quests
        .filter((q: any) => (q.owner === me || q.personal) && !isQuestDoneNow(q) && !q.collaborative)
        .sort((a: any, b: any) => (b.id || 0) - (a.id || 0));

      return allPersonalActive.slice(0, 5);
    }
    if (tab === 'daily') return quests.filter((q: any) => q.recur === 'daily');
    if (tab === 'strategic') return quests.filter((q: any) => q.type === 'strategic');
    if (tab === 'hidden') {
      const hidden = getRoleHidden(roleType);
      const hiddenIds = new Set(hidden.map((h: any) => h.id));
      return quests.filter((q: any) => q.type === 'hidden' || hiddenIds.has(q.id));
    }
    if (tab === 'sidequest') return quests.filter((q: any) => q.type === 'sidequest');
    return quests;
  }

  function applyFilter(quests: any[]) {
    if (filter === 'alla') return quests;
    return quests.filter((q: any) => getQuestOrigin(q) === filter);
  }

  const baseVisible = getVisibleQuests();
  const visible = applyFilter(baseVisible);
  const active = visible.filter((q: any) => !isQuestDoneNow(q));
  const shouldShowCollabSection = collabQuests.length > 0 && (
    filter === 'collaborative' || (filter === 'alla' && tab === 'all')
  );
  const activeNonCollaborative = shouldShowCollabSection
    ? active.filter((q: any) => !q.collaborative)
    : active;
  const completed = visible.filter((q: any) => isQuestDoneNow(q));
  const hasQuestContent = visible.length > 0 || shouldShowCollabSection;
  const allDone = hasQuestContent && active.length === 0 && !shouldShowCollabSection;
  const relevantQuests = getRelevantActiveQuests(activeNonCollaborative, me || undefined, 2);
  const focusQuest = relevantQuests[0];
  const followUpQuest = relevantQuests[1];

  const showGrouped = filter === 'alla' && tab === 'all';

  function getGroupedQuests() {
    const groups: { key: string; label: string; quests: any[] }[] = [];
    const roleTypes = ['builder', 'amplifier', 'enabler'];
    roleTypes.forEach(rt => {
      const memberIds = Object.entries(MEMBERS).filter(([_, m]) => m.roleType === rt).map(([id]) => id);
      const roleQuests = active.filter((q: any) => memberIds.includes(q.owner) && !q.personal);
      if (roleQuests.length > 0) {
        const label = ROLE_TYPE_LABEL[rt]?.label || rt;
        groups.push({ key: rt, label: label + ' QUESTS', quests: roleQuests });
      }
    });
    const personalQuests = active.filter((q: any) => q.personal || q.owner === me);
    if (personalQuests.length > 0) {
      groups.push({ key: 'personal', label: 'PERSONLIGA UPPDRAG', quests: personalQuests });
    }
    return groups;
  }

  function handleRefreshPersonal() {
    if (!me) return;
    setRefreshing(true);
    generatePersonalQuests(true).then(() => {
      setRefreshing(false);
    });
  }

  async function handleSidequestNudgeClick() {
    const quests = await showSidequestNudge();
    onSidequestNudge?.(quests);
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.04, duration: 0.2, ease: 'easeOut' as const },
    }),
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
  };

  // Hämta och prenumerera på collaborative quests
  useEffect(() => {
    const quests = S.quests || [];
    if (refreshRecurringQuestStates(quests)) {
      save();
      rerender();
    }
  }, [cycleRefreshKey, me, rerender]);

  useEffect(() => {
    fetchMyCollaborativeQuests().then(setCollabQuests)

    const sub = subscribeCollaborativeQuests((updatedQuest) => {
      setCollabQuests(prev => {
        const idx = prev.findIndex(q => q.id === updatedQuest.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = updatedQuest
          return next.filter(q => !q.done && !isQuestDoneNow(q))
        }
        return [...prev, updatedQuest].filter(q => !q.done && !isQuestDoneNow(q))
      })
    })

    const collabChannel = supabase
      .channel('collaborative-quests-global')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'collaborative_quests',
      }, async () => {
        const latest = await fetchMyCollaborativeQuests()
        setCollabQuests(latest)
      })
      .subscribe()

    return () => {
      sub?.unsubscribe()
      supabase.removeChannel(collabChannel)
    }
  }, [S.me])

  const activePersonalCount = (S.quests || []).filter(
    (q: any) => q.owner === me && !isQuestDoneNow(q)
  ).length;

  useEffect(() => {
    const c = me ? S.chars[me] : null;
    if (c?.needsQuestRefill) {
      c.needsQuestRefill = false;
      save();
      generatePersonalQuests(false);
    }
  }, [activePersonalCount]);

  useEffect(() => {
    if (!me) return;
    getDailyCoachMessage(me).then(setCoachMessage).catch(() => {});
  }, [me]);

  const coachName = (S.chars[me!] as any)?.coachName || 'Coach';

  function handleFilterChange(nextFilter: string) {
    setFilter(nextFilter);
    if (nextFilter === 'collaborative' && tab !== 'all') {
      setTab('all');
      S.tab = 'all';
    }
  }

  function handleTabChange(nextTab: string) {
    setTab(nextTab);
    S.tab = nextTab;
    if (nextTab !== 'all' && filter === 'collaborative') {
      setFilter('alla');
    }
  }

  return (
    <div className="quest-center">
      {/* Coach card */}
      {me && (
        <div
          onClick={() => onOpenCoach?.(coachMessage)}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-card)',
            padding: CARD_PAD_ROOM,
            marginBottom: SECTION_GAP_COMPACT,
            cursor: 'pointer',
            touchAction: 'manipulation',
            position: 'relative',
          }}
        >
          <div style={{
            fontSize: 11,
            letterSpacing: '0.1em',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-ui)',
            marginBottom: 6,
          }}>
            {coachName.toUpperCase()}
          </div>
          <div style={{
            fontSize: 14,
            color: 'var(--color-text)',
            lineHeight: 1.5,
            marginBottom: focusQuest ? 'var(--space-md)' : 0,
          }}>
            {coachMessage || '...'}
          </div>

          {focusQuest && (
            <div style={{
              marginTop: SECTION_GAP_COMPACT,
              padding: CARD_PAD,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 6,
              }}>
                Fokus nu
              </div>
              <div style={{
                fontSize: 'var(--text-body)',
                color: 'var(--color-text)',
                fontWeight: 600,
                marginBottom: 4,
              }}>
                {focusQuest.title}
              </div>
              <div style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                lineHeight: 1.45,
              }}>
                {getQuestFocusReason(focusQuest, me || undefined)}
              </div>
              {followUpQuest && (
                <div style={{
                  marginTop: 'var(--space-sm)',
                  fontSize: 'var(--text-micro)',
                  color: 'var(--color-text-muted)',
                }}>
                  Efter det: {followUpQuest.title}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: CARD_PAD,
        display: 'flex',
        flexDirection: 'column',
        gap: SECTION_GAP_COMPACT,
      }}>
        {/* Minimal header */}
        <div className="qv-header" style={{ padding: 0 }}>
          <span className="qv-header-op">{S.operationName || 'Operation POST II'}</span>
          <span className="qv-header-week">Vecka {S.weekNum || getWeekNumber()}</span>
        </div>

        {/* Filter pills */}
        <div className="qf-pills stagger-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              className={'qf-pill ' + (filter === f.id ? 'active' : '')}
              onClick={() => handleFilterChange(f.id)}
            >{f.label}</button>
          ))}
        </div>
      </div>

      <DelegationInbox rerender={rerender} />

      <div className="quest-tabs stagger-2">
        {TABS.map(t => (
          <button
            key={t.id}
            className={'tab-btn ' + (tab === t.id ? 'active' : '')}
            onClick={() => handleTabChange(t.id)}
          >{t.label}</button>
        ))}
        {tab === 'personal' && (
          <button className="tab-btn" onClick={handleRefreshPersonal} disabled={refreshing}>
            <RefreshCw size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
            {refreshing ? '...' : 'NY'}
          </button>
        )}
        {tab === 'sidequest' && (
          <button className="tab-btn" onClick={handleSidequestNudgeClick}>
            <Zap size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
            FORSLAG
          </button>
        )}
      </div>

      {allDone && (
        <div className="all-done-nudge stagger-3">Alla synliga uppdrag slutforda! Bra jobbat.</div>
      )}

      {refreshing ? (
        <div className="quest-grid stagger-3">
          <QuestCardSkeleton />
          <QuestCardSkeleton />
          <QuestCardSkeleton />
        </div>
      ) : !hasQuestContent ? (
        <div className="empty-state stagger-3">
          <Compass size={48} strokeWidth={1} />
          <div className="empty-text">
            {filter === 'collaborative' ? 'Inga kollaborativa uppdrag just nu.' : 'Inga aktiva quests just nu.'}
          </div>
        </div>
      ) : showGrouped ? (
        <div className="quest-grid stagger-3">
          <AnimatePresence mode="sync">
            {getGroupedQuests().map((group, gi) => (
              <React.Fragment key={group.key}>
                <motion.div
                  className="qf-section-header"
                  custom={gi}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  style={{ gridColumn: '1 / -1' }}
                >
                  {group.label}
                </motion.div>
                {group.quests.map((q: any, qi: number) => (
                  <QuestCard key={q.id} quest={q} rerender={rerender} showLU={showLU} showRW={showRW} showXP={showXP} />
                ))}
              </React.Fragment>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <>
          {focusQuest && !showGrouped && (
            <div style={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-card)',
              padding: `${CARD_PAD} ${CARD_PAD}`,
            }}>
              <div className="qf-section-header" style={{ padding: 0, marginBottom: 6 }}>
                Börja här
              </div>
              <div style={{
                fontSize: 'var(--text-body)',
                color: 'var(--color-text)',
                fontWeight: 600,
                marginBottom: 4,
              }}>
                {focusQuest.title}
              </div>
              <div style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                lineHeight: 1.45,
              }}>
                {getQuestFocusReason(focusQuest, me || undefined)}
              </div>
            </div>
          )}
          {shouldShowCollabSection && (
            <div style={{ marginBottom: SECTION_GAP_COMPACT }}>
              {collabQuests.map(q => (
                <CollaborativeQuestCard
                  key={q.id}
                  quest={q}
                  onUpdate={() => fetchMyCollaborativeQuests().then(setCollabQuests)}
                />
              ))}
            </div>
          )}
          <SortableQuestList
            quests={activeNonCollaborative}
            rerender={rerender}
            showLU={showLU}
            showRW={showRW}
            showXP={showXP}
          />
        </>
      )}


      {/* Skapa uppdrag-knapp */}
      <button
        onClick={() => setShowCreateQuest(true)}
        style={{
          width: '100%',
          background: 'transparent',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-card)',
          minHeight: CONTROL_HEIGHT,
          padding: '0 14px',
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-ui)',
          letterSpacing: '0.08em',
          cursor: 'pointer',
          touchAction: 'manipulation',
          marginTop: SECTION_GAP_COMPACT,
        }}
      >
        + SKAPA UPPDRAG
      </button>

      {showCreateQuest && (
        <CreateQuestModal
          onClose={() => setShowCreateQuest(false)}
          rerender={rerender}
        />
      )}
    </div>
  );
}
export default React.memo(QuestGrid);
