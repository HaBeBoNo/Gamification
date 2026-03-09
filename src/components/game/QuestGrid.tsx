import React, { useState } from 'react';
import { S, save } from '@/state/store';
import { MEMBERS, ROLE_TYPES, ROLE_TYPE_LABEL } from '@/data/members';
import { getRoleHidden, HIDDEN_BY_TYPE } from '@/data/quests';
import QuestCard from './QuestCard';
import WeeklyCheckout from './WeeklyCheckout';
import { showSidequestNudge, generatePersonalQuests } from '@/hooks/useAI';
import { Compass, RefreshCw, Zap } from 'lucide-react';
import QuestCardSkeleton from './skeletons/QuestCardSkeleton';

const TABS = [
  { id: 'personal', label: 'MINA' },
  { id: 'daily', label: 'DAGLIGA' },
  { id: 'strategic', label: 'STRATEGISKA' },
  { id: 'hidden', label: 'DOLDA' },
  { id: 'sidequest', label: 'SIDEQUEST' },
  { id: 'all', label: 'ALLA' },
];

interface QuestGridProps {
  rerender: () => void;
  showLU: (level: number) => void;
  showRW: (reward: any, tier?: string) => void;
  showSidequestNudge?: (quests: any[]) => void;
}

export default function QuestGrid({ rerender, showLU, showRW, showSidequestNudge: onSidequestNudge }: QuestGridProps) {
  const [tab, setTab] = useState(S.tab || 'personal');
  const [refreshing, setRefreshing] = useState(false);

  const me = S.me;
  const char = me ? S.chars[me] : null;
  const roleType = char?.roleType || MEMBERS[me!]?.roleType || 'amplifier';

  function getVisibleQuests() {
    const quests = S.quests || [];
    if (tab === 'all') return quests;
    if (tab === 'personal') return quests.filter((q: any) => q.owner === me || q.personal);
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

  const visible = getVisibleQuests();
  const allDone = visible.length > 0 && visible.every((q: any) => q.done);

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

  return (
    <div className="quest-center">
      <div className="stagger-1"><WeeklyCheckout rerender={rerender} /></div>
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
          <Compass size={28} strokeWidth={1} style={{ opacity: 0.25 }} />
          <div className="empty-text">Inga aktiva quests just nu. Dags att kolla in?</div>
        </div>
      ) : (
        <div className="quest-grid stagger-3">
          {visible.map((q: any) => (
            <QuestCard key={q.id} quest={q} rerender={rerender} showLU={showLU} showRW={showRW} />
          ))}
        </div>
      )}
    </div>
  );
}
