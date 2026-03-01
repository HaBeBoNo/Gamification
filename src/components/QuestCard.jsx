import React, { useState } from 'react';
import { S, save } from '../state/store';
import { awardXP } from '../hooks/useXP';
import { aiValidate } from '../hooks/useAI';

const CAT_BADGE = {
  daily:     'badge-daily',
  personal:  'badge-personal',
  strategic: 'badge-strategic',
  hidden:    'badge-hidden',
  social:    'badge-social',
  sidequest: 'badge-sidequest',
  wisdom:    'badge-hidden',
  health:    'badge-hidden',
  tech:      'badge-hidden',
  money:     'badge-hidden',
  global:    'badge-daily',
};

const CAT_LABEL = {
  daily:     'DAGLIG',
  personal:  'PERSONLIG',
  strategic: 'STRATEGISK',
  hidden:    'DOLD',
  social:    'SOCIAL',
  sidequest: 'SIDEQUEST',
  wisdom:    'VISDOM',
  health:    'HÄLSA',
  tech:      'TECH',
  money:     'EKONOMI',
  global:    'GLOBAL',
};

const TYPE_BORDER = {
  strategic: 'rgba(144,96,224,0.3)',
  hidden:    'rgba(64,128,224,0.25)',
  ghost:     'rgba(100,120,180,0.3)',
};

export default function QuestCard({ quest, rerender, showLU, showRW }) {
  const [aiDesc, setAiDesc]     = useState('');
  const [thinking, setThinking] = useState(false);
  const [verdict, setVerdict]   = useState(quest.aiVerdict || null);

  const me     = S.me;
  const isDone = quest.done;

  // Strategic quests and any quest with aiRequired need AI validation
  const needsAI = quest.type === 'strategic' || quest.aiRequired;

  function handleComplete(event) {
    if (isDone || !me) return;
    const xp  = quest.xp || 30;
    const idx = S.quests.findIndex(q => q.id === quest.id);
    if (idx >= 0) S.quests[idx].done = true;
    // useXP.js signature: awardXP(q, xpEarned, event, rerender, showLU, showRW, showXPPop, rollReward)
    awardXP(quest, xp, event, rerender, showLU, showRW);
    save();
    rerender();
  }

  async function handleAIValidate() {
    if (!aiDesc.trim() || !me) return;
    setThinking(true);
    try {
      // useAI.js signature: aiValidate(q, desc, event, rerender, showLU, showRW, showXPPop, rollReward)
      await aiValidate(quest, aiDesc, null, rerender, showLU, showRW);
      // aiValidate mutates S.quests[idx].aiVerdict directly — read it back
      const updated = S.quests.find(q => q.id === quest.id);
      setVerdict(updated?.aiVerdict || null);
    } catch {
      // silently ignore — aiValidate has its own internal error handling
    }
    setThinking(false);
  }

  const badgeClass  = CAT_BADGE[quest.cat] || 'badge-daily';
  const badgeLabel  = CAT_LABEL[quest.cat]  || quest.cat?.toUpperCase() || 'UPPDRAG';
  const borderColor = TYPE_BORDER[quest.type] || (quest.personal ? 'rgba(240,192,64,0.2)' : undefined);

  // Always read live verdict from S (aiValidate mutates it) — fall back to local state
  const liveVerdict = S.quests.find(q => q.id === quest.id)?.aiVerdict || verdict;
  const isThinking  = S.quests.find(q => q.id === quest.id)?.aiThinking || thinking;

  return (
    <div
      className={`quest-card ${isDone ? 'done' : ''} ${quest.type === 'ghost' ? 'ghost' : ''}`}
      style={borderColor ? { borderColor } : {}}
    >
      {isDone && <div className="done-stamp">✓ KLAR</div>}

      <div className="quest-card-head">
        <span className="quest-icon">
          {quest.stars || (quest.type === 'hidden' ? '🔵' : quest.type === 'strategic' ? '🔥' : '⭐')}
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          <span className={`quest-badge ${badgeClass}`}>{badgeLabel}</span>
          {quest.type && quest.type !== 'standard' && (
            <span className="quest-type-badge">{quest.type.toUpperCase()}</span>
          )}
          <div className="quest-title" style={{ marginTop:4 }}>{quest.title}</div>
        </div>
      </div>

      <div className="quest-desc">{quest.desc}</div>

      <div className="quest-meta">
        <span className="quest-xp">⚡ {quest.xp} XP</span>
        {quest.recur && quest.recur !== 'none' && (
          <span className="quest-recur">{quest.recur}</span>
        )}
        {quest.region && quest.region !== 'all' && (
          <span className="quest-region">{quest.region}</span>
        )}
      </div>

      {/* Live AI verdict — shown whenever present */}
      {liveVerdict && (
        <div className={`quest-ai-verdict ${liveVerdict.cls || ''}`}>{liveVerdict.text}</div>
      )}

      {/* AI reflection area — only shown for strategic/aiRequired quests before verdict */}
      {needsAI && !isDone && !liveVerdict && (
        <div className="quest-ai-area">
          <textarea
            className="quest-ai-input"
            placeholder="Beskriv hur du genomförde uppdraget..."
            value={aiDesc}
            onChange={e => setAiDesc(e.target.value)}
            disabled={isThinking}
          />
          {isThinking ? (
            <div className="quest-ai-thinking">
              <div className="refresh-spinner" style={{
                width:14, height:14,
                border:'2px solid rgba(255,255,255,0.1)',
                borderTopColor:'var(--gold)',
                borderRadius:'50%',
                animation:'spin 0.8s linear infinite',
              }} />
              AI granskar...
            </div>
          ) : (
            <button
              className="complete-btn"
              onClick={handleAIValidate}
              disabled={aiDesc.trim().length < 10}
            >
              VALIDERA MED AI
            </button>
          )}
        </div>
      )}

      {/* Complete button — shown when not done, and either no AI needed or verdict arrived */}
      {!isDone && (!needsAI || liveVerdict) && (
        <button className="complete-btn" onClick={handleComplete}>
          SLUTFÖR
        </button>
      )}
    </div>
  );
}