import React, { useState, useEffect } from 'react';
import { S, save } from '@/state/store';
import { MEMBERS, ROLE_TYPES, ROLE_TYPE_LABEL } from '@/data/members';
import { getRoleHidden, HIDDEN_BY_TYPE } from '@/data/quests';
import QuestCard from './QuestCard';
import SortableQuestList from './SortableQuestList';
import DelegationInbox from './DelegationInbox';
import { showSidequestNudge, generatePersonalQuests } from '@/hooks/useAI';
import { Compass, RefreshCw, Zap, CheckCircle, X } from 'lucide-react';
import QuestCardSkeleton from './skeletons/QuestCardSkeleton';
import { motion, AnimatePresence } from 'framer-motion';

const TABS = [
  { id: 'personal', label: 'MINA' },
  { id: 'daily', label: 'DAGLIGA' },
  { id: 'strategic', label: 'STRATEGISKA' },
  { id: 'hidden', label: 'DOLDA' },
  { id: 'sidequest', label: 'SIDEQUEST' },
  { id: 'all', label: 'ALLA' },
];

const FILTERS = [
  { id: 'alla', label: 'Alla' },
  { id: 'aktiva', label: 'Aktiva' },
  { id: 'avklarade', label: 'Avklarade' },
  { id: 'veckovisa', label: 'Veckovisa' },
  { id: 'strategiska', label: 'Strategiska' },
  { id: 'kreativa', label: 'Kreativa' },
];

interface QuestGridProps {
  rerender: () => void;
  showLU: (level: number) => void;
  showRW: (reward: any, tier?: string) => void;
  showSidequestNudge?: (quests: any[]) => void;
  showXP?: (amount: number) => void;
  onQuestTap?: (quest: any) => void;
}

function getWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

export default function QuestGrid({ rerender, showLU, showRW, showSidequestNudge: onSidequestNudge, showXP }: QuestGridProps) {
  const [tab, setTab] = useState(S.tab || 'personal');
  const [filter, setFilter] = useState('alla');
  const [refreshing, setRefreshing] = useState(false);

  const me = S.me;
  const char = me ? S.chars[me] : null;
  const roleType = char?.roleType || MEMBERS[me!]?.roleType || 'amplifier';

  function getVisibleQuests() {
    const quests = S.quests || [];
    if (tab === 'all') return quests;
    if (tab === 'personal') {
      const personalActive = quests
        .filter((q: any) => (q.owner === me || q.personal) && !q.done)
        .sort((a: any, b: any) => (b.id || 0) - (a.id || 0))
        .slice(0, 5); // max 5 aktiva
      const personalDone = quests.filter((q: any) => (q.owner === me || q.personal) && q.done);
      return [...personalActive, ...personalDone];
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
    switch (filter) {
      case 'aktiva': return quests.filter((q: any) => !q.done);
      case 'avklarade': return quests.filter((q: any) => q.done);
      case 'veckovisa': return quests.filter((q: any) => q.recur === 'weekly' || q.recur === 'daily');
      case 'strategiska': return quests.filter((q: any) => q.type === 'strategic' || q.cat === 'strategic');
      case 'kreativa': return quests.filter((q: any) => q.cat === 'social' || q.cat === 'personal' || q.type === 'sidequest');
      default: return quests;
    }
  }

  const baseVisible = getVisibleQuests();
  const visible = applyFilter(baseVisible);
  const active = visible.filter((q: any) => !q.done);
  const completed = visible.filter((q: any) => q.done);
  const allDone = visible.length > 0 && active.length === 0;

  const showGrouped = filter === 'alla' && tab === 'all';

  function getGroupedQuests() {
    const groups: { key: string; label: string; quests: any[] }[] = [];
    const roleTypes = ['builder', 'amplifier', 'enabler'];
    roleTypes.forEach(rt => {
      const memberIds = Object.entries(MEMBERS).filter(([_, m]) => m.roleType === rt).map(([id]) => id);
      const roleQuests = active.filter((q: any) => memberIds.includes(q.owner) && !q.personal);
      if (roleQuests.length > 0) {
        const label = ROLE_TYPE_LABEL[rt]?.label || rt;
        groups.push({ key: rt, label: `${label} QUESTS`, quests: roleQuests });
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
    generatePersonalQuests(true, () => {
      save();
      setRefreshing(false);
      rerender();
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

  const [calStripVisible, setCalStripVisible] = useState(true);

  // Auto-generera när aktiva quests sjunker under 3
  const activePersonalCount = (S.quests || []).filter(
    (q: any) => q.owner === me && !q.done
  ).length;

  useEffect(() => {
    const c = me ? S.chars[me] : null;
    if (c?.needsQuestRefill) {
      c.needsQuestRefill = false;
      save();
      generatePersonalQuests(false, () => { save(); rerender(); });
    }
  }, [activePersonalCount]);

  const UPCOMING_EVENTS = [
    { date: '9 mar', name: 'Rep Lerum' },
    { date: '15 mar', name: 'Styrelsemöte' },
    { date: '22 mar', name: 'Studiosession' },
  ];

  return (
    <div className="quest-center">
      {/* Calendar strip */}
      {calStripVisible && (
        <div className="cal-strip">
          {UPCOMING_EVENTS.map((ev, i) => (
            <span key={i} className="cal-strip-pill">{ev.date} · {ev.name}</span>
          ))}
          <button className="cal-strip-link">Kalender →</button>
          <button className="cal-strip-close" onClick={() => setCalStripVisible(false)}><X size={12} /></button>
        </div>
      )}

      {/* Minimal header */}
      <div className="qv-header">
        <span className="qv-header-op">{S.operationName || 'Operation POST II'}</span>
        <span className="qv-header-week">Vecka {S.weekNum || getWeekNumber()}</span>
      </div>

      {/* Filter pills */}
      <div className="qf-pills stagger-1">
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={`qf-pill ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >{f.label}</button>
        ))}
      </div>

      <DelegationInbox rerender={rerender} />

      <div className="quest-tabs stagger-2">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); S.tab = t.id; }}
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
            FÖRSLAG
          </button>
        )}
      </div>

      {allDone && (
        <div className="all-done-nudge stagger-3">✅ Alla synliga uppdrag slutförda! Bra jobbat.</div>
      )}

      {refreshing ? (
        <div className="quest-grid stagger-3">
          <QuestCardSkeleton />
          <QuestCardSkeleton />
          <QuestCardSkeleton />
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state stagger-3">
          <Compass size={48} strokeWidth={1} />
          <div className="empty-text">Inga aktiva quests just nu.</div>
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
            {completed.map((q: any) => (
              <QuestCard key={q.id} quest={q} rerender={rerender} showLU={showLU} showRW={showRW} showXP={showXP} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <SortableQuestList
          quests={[...active, ...completed]}
          rerender={rerender}
          showLU={showLU}
          showRW={showRW}
          showXP={showXP}
        />
      )}
      {completed.length === 0 && active.length > 0 && (
        <div className="empty-state stagger-4" style={{ padding: 'var(--space-xl)' }}>
          <CheckCircle size={48} strokeWidth={1} />
          <div className="empty-text">Inga avklarade uppdrag än. Det ändras snart.</div>
        </div>
      )}
    </div>
  );
}
