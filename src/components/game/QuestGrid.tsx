import React, { useState, useEffect } from 'react';
import { S, save } from '@/state/store';
import { MEMBERS, ROLE_TYPES, ROLE_TYPE_LABEL } from '@/data/members';
import { getRoleHidden, HIDDEN_BANK } from '@/data/quests';
import QuestCard from './QuestCard';
import SortableQuestList from './SortableQuestList';
import DelegationInbox from './DelegationInbox';
import { showSidequestNudge, generatePersonalQuests } from '@/hooks/useAI';
import { Compass, RefreshCw, Zap } from 'lucide-react';
import QuestCardSkeleton from './skeletons/QuestCardSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import CreateQuestModal from './CreateQuestModal';

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
  onOpenCoach?: (initialMessage?: string) => void;
}

function getWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

export default function QuestGrid({ rerender, showLU, showRW, showSidequestNudge: onSidequestNudge, showXP, onOpenCoach }: QuestGridProps) {
  const [tab, setTab] = useState(S.tab || 'personal');
  const [filter, setFilter] = useState('alla');
  const [refreshing, setRefreshing] = useState(false);
  const [coachMessage, setCoachMessage] = useState('');
  const [showCreateQuest, setShowCreateQuest] = useState(false);

  const me = S.me;
  const char = me ? S.chars[me] : null;
  const roleType = char?.roleType || MEMBERS[me!]?.roleType || 'amplifier';

  function getVisibleQuests() {
    const quests = S.quests || [];
    if (tab === 'all') return quests;
    if (tab === 'personal') {
      const collaborativeQuests = quests.filter(
        (q: any) => q.collaborative && !q.done
      );

      const allPersonalActive = quests
        .filter((q: any) => (q.owner === me || q.personal) && !q.done && !q.collaborative)
        .sort((a: any, b: any) => (b.id || 0) - (a.id || 0));

      const slot3 = collaborativeQuests[0] || null;

      const displayQuests = [
        ...allPersonalActive.slice(0, 2),
        ...(slot3 ? [slot3] : []),
        ...allPersonalActive.slice(2, 4),
      ].slice(0, 5);

      return displayQuests;
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

  const activePersonalCount = (S.quests || []).filter(
    (q: any) => q.owner === me && !q.done
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
    const cached = (S.chars[me] as any)?.dailyCoachMessage;
    const cachedDate = (S.chars[me] as any)?.dailyCoachDate;
    const today = new Date().toDateString();

    if (cached && cachedDate === today) {
      setCoachMessage(cached);
      return;
    }

    const coachNameStr = (S.chars[me] as any)?.coachName || 'Coach';
    const charData = S.chars[me] as any;
    const promptText = [
      'Du ar ' + coachNameStr + ', personlig AI-coach for ' + me + ' i bandet Sektionen.',
      charData?.motivation ? 'Motivation: ' + charData.motivation : '',
      charData?.roleEnjoy ? 'Trivs med: ' + charData.roleEnjoy : '',
      'Niva ' + (charData?.level || 1) + ', ' + (charData?.totalXp || 0) + ' XP totalt.',
    ].filter(Boolean).join('\n');

    fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: promptText + '\n\nSkriv ett kort proaktivt meddelande (max 2 meningar) till ' + me + ' for idag. Ingen halsningsfras. Direkt in i sak.',
        }],
      }),
    })
      .then(r => r.json())
      .then(data => {
        const msg = data.content?.[0]?.text?.trim();
        if (msg && me) {
          (S.chars[me] as any).dailyCoachMessage = msg;
          (S.chars[me] as any).dailyCoachDate = today;
          save();
          setCoachMessage(msg);
        }
      })
      .catch(() => {});
  }, [me]);

  const coachName = (S.chars[me!] as any)?.coachName || 'Coach';

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
            padding: '16px',
            marginBottom: 16,
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
          }}>
            {coachMessage || '...'}
          </div>
          <div style={{
            position: 'absolute',
            top: 16, right: 16,
            fontSize: 11,
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-ui)',
          }}>
            OPPNA →
          </div>
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
            className={'qf-pill ' + (filter === f.id ? 'active' : '')}
            onClick={() => setFilter(f.id)}
          >{f.label}</button>
        ))}
      </div>

      <DelegationInbox rerender={rerender} />

      <div className="quest-tabs stagger-2">
        {TABS.map(t => (
          <button
            key={t.id}
            className={'tab-btn ' + (tab === t.id ? 'active' : '')}
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
          </AnimatePresence>
        </div>
      ) : (
        <SortableQuestList
          quests={active}
          rerender={rerender}
          showLU={showLU}
          showRW={showRW}
          showXP={showXP}
        />
      )}


      {/* Skapa uppdrag-knapp */}
      <button
        onClick={() => setShowCreateQuest(true)}
        style={{
          width: '100%',
          background: 'transparent',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-card)',
          padding: '14px',
          fontSize: 13,
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-ui)',
          letterSpacing: '0.08em',
          cursor: 'pointer',
          touchAction: 'manipulation',
          marginTop: 8,
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