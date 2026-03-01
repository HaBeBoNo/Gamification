import React, { useState } from 'react';
import { S, save } from '../state/store';
import { MEMBERS } from '../data/members';
import { getRoleHidden } from '../data/quests';
import QuestCard from './QuestCard';
import WeeklyCheckout from './WeeklyCheckout';
import { showSidequestNudge, generatePersonalQuests } from '../hooks/useAI';

const TABS = [
  { id:'personal',  label:'MINA'       },
  { id:'daily',     label:'DAGLIGA'    },
  { id:'strategic', label:'STRATEGISKA'},
  { id:'hidden',    label:'DOLDA'      },
  { id:'sidequest', label:'SIDEQUEST'  },
  { id:'all',       label:'ALLA'       },
];

export default function QuestGrid({ rerender, showLU, showRW, showSidequestNudge: onSidequestNudge }) {
  const [tab, setTab] = useState(S.tab || 'personal');
  const [refreshing, setRefreshing] = useState(false);

  const me = S.me;
  const char = me ? S.chars[me] : null;
  const roleType = char?.roleType || MEMBERS[me]?.roleType || 'amplifier';

  // Base: only my quests, undone
  const myQuests = (S.quests || []).filter(q => q.owner === S.me && !q.done);

  function getVisibleQuests() {
    if (tab === 'all')       return myQuests;
    if (tab === 'personal')  return myQuests.filter(q => q.personal === true);
    if (tab === 'daily')     return myQuests.filter(q => q.recur === 'daily');
    if (tab === 'strategic') return myQuests.filter(q => q.type === 'strategic' && !q.personal);
    if (tab === 'hidden') {
      const hidden = getRoleHidden(roleType);
      const hiddenIds = new Set(hidden.map(h => h.id));
      return myQuests.filter(q => q.type === 'hidden' || hiddenIds.has(q.id));
    }
    if (tab === 'sidequest') return myQuests.filter(q => q.type === 'sidequest' || q.cat === 'sidequest');
    // standard fallback
    return myQuests.filter(q => q.type === 'standard' && q.recur !== 'daily' && !q.personal);
  }

  const visible = getVisibleQuests();
  const allDone = myQuests.length > 0 && myQuests.every(q => q.done);

  async function handleRefreshPersonal() {
    if (!me) return;
    setRefreshing(true);
    try {
      await generatePersonalQuests(true, () => {});
      save();
      rerender();
    } catch {
      // silently ignore
    }
    setRefreshing(false);
  }

  async function handleSidequestNudge() {
    const weekKey = `w${S.weekNum}`;
    const quests = await showSidequestNudge(weekKey);
    onSidequestNudge?.(quests);
  }

  return (
    <div className="quest-center">
      <WeeklyCheckout rerender={rerender} />
      <div className="quest-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); S.tab = t.id; }}
          >
            {t.label}
          </button>
        ))}
        {tab === 'personal' && (
          <button className="tab-btn" onClick={handleRefreshPersonal} disabled={refreshing}>
            {refreshing ? '...' : '↻ NY'}
          </button>
        )}
        {tab === 'sidequest' && (
          <button className="tab-btn" onClick={handleSidequestNudge}>
            ⚡ FÖRSLAG
          </button>
        )}
      </div>

      {allDone && (
        <div className="all-done-nudge">
          ✅ Alla dina uppdrag slutförda! Bra jobbat.
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <div className="empty-text">Inga uppdrag i den här kategorin.</div>
        </div>
      ) : (
        <div className="quest-grid">
          {visible.map(q => (
            <QuestCard
              key={q.id}
              quest={q}
              rerender={rerender}
              showLU={showLU}
              showRW={showRW}
            />
          ))}
        </div>
      )}
    </div>
  );
}