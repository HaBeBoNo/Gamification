import React, { useState } from 'react';
import { S, save } from '../state/store';
import { MEMBERS } from '../data/members';
import { getRoleHidden } from '../data/quests';
import QuestCard from './QuestCard';
import WeeklyCheckout from './WeeklyCheckout';
import { showSidequestNudge, generatePersonalQuests } from '../hooks/useAI';
import { ROLE_TYPES, ROLE_TYPE_LABEL } from '../data/members';
import { HIDDEN_BY_TYPE } from '../data/quests';

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

  function getVisibleQuests() {
    const quests = S.quests || [];
    if (tab === 'all') return quests;
    if (tab === 'personal') return quests.filter(q => q.personal || q.cat === 'personal');
    if (tab === 'daily') return quests.filter(q => q.cat === 'daily');
    if (tab === 'strategic') return quests.filter(q => q.cat === 'strategic');
    if (tab === 'hidden') {
      const hidden = getRoleHidden(roleType);
      const hiddenIds = new Set(hidden.map(h => h.id));
      return quests.filter(q => q.cat === 'hidden' || hiddenIds.has(q.id));
    }
    if (tab === 'sidequest') return quests.filter(q => q.cat === 'sidequest');
    return quests;
  }

  const visible = getVisibleQuests();
  const allDone = visible.length > 0 && visible.every(q => q.done);

  function handleRefreshPersonal() {
    if (!me) return;
    setRefreshing(true);
    generatePersonalQuests(
      S, MEMBERS, ROLE_TYPES, ROLE_TYPE_LABEL, HIDDEN_BY_TYPE, getRoleHidden,
      true,
      {
        onStart: () => {},
        onProgress: () => {},
        onDone: () => { save(); setRefreshing(false); rerender(); },
        onError: () => { setRefreshing(false); },
      }
    );
  }

  function handleSidequestNudge() {
    const weekKey = `w${S.weekNum}`;
    showSidequestNudge(weekKey, S, MEMBERS, (quests) => {
      onSidequestNudge?.(quests);
    });
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
          ✅ Alla synliga uppdrag slutförda! Bra jobbat.
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
