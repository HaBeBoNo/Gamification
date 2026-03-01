import React, { useState } from 'react';
import { S, save } from '../state/store';
import { MEMBERS } from '../data/members';
import { getRoleHidden } from '../data/quests';
import { awardXP } from '../hooks/useXP';
import { aiValidate } from '../hooks/useAI';
import { calcQuestXP } from '../hooks/useXP';

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
};

export default function QuestCard({ quest, rerender, showLU, showRW, showQuestModal }) {
  const [aiDesc, setAiDesc] = useState('');
  const [thinking, setThinking] = useState(false);
  const [verdict, setVerdict] = useState(quest.aiVerdict || null);

  const me = S.me;
  const isDone = quest.done;
  const needsAI = quest.aiRequired;

  function handleComplete() {
    if (isDone || !me) return;

    if (needsAI && !verdict?.approved) {
      // Need to validate first
      return;
    }

    const xpEarned = calcQuestXP(me, quest.xp || 30);
    const idx = S.quests.findIndex(q => q.id === quest.id);
    if (idx >= 0) {
      S.quests[idx] = { ...quest, done: true };
    }
    awardXP(
      quest, xpEarned, null, S, save, rerender,
      null,
      (level) => showLU?.(level),
      (reward, tier) => showRW?.(reward, tier),
    );
    save();
    rerender();
  }

  function handleAIValidate() {
    if (!aiDesc.trim() || !me) return;
    setThinking(true);
    aiValidate(quest, aiDesc, S, MEMBERS, (result) => {
      setThinking(false);
      setVerdict(result);
      const idx = S.quests.findIndex(q => q.id === quest.id);
      if (idx >= 0) {
        S.quests[idx] = { ...S.quests[idx], aiVerdict: result };
      }
      save();
    });
  }

  const badgeClass = CAT_BADGE[quest.cat] || 'badge-daily';
  const badgeLabel = CAT_LABEL[quest.cat] || quest.cat?.toUpperCase() || 'UPPDRAG';

  return (
    <div
      className={`quest-card ${isDone ? 'done' : ''}`}
      style={quest.personal ? { borderColor:'rgba(240,192,64,0.2)' } : {}}
    >
      {isDone && <div className="done-stamp">✓ KLAR</div>}
      <div className="quest-card-head">
        <span className="quest-icon">{quest.icon || '⭐'}</span>
        <div>
          <span className={`quest-badge ${badgeClass}`}>{badgeLabel}</span>
          <div className="quest-title" style={{ marginTop: 4 }}>
            {quest.title}
          </div>
        </div>
      </div>
      <div className="quest-desc">{quest.desc}</div>
      <div className="quest-meta">
        <span className="quest-xp">⚡ {quest.xp} XP</span>
        {quest.recur && <span className="quest-recur">{quest.recur}</span>}
        {quest.region && quest.region !== 'all' && (
          <span className="quest-region">{quest.region}</span>
        )}
      </div>

      {needsAI && !isDone && (
        <div className="quest-ai-area">
          <textarea
            className="quest-ai-input"
            placeholder="Beskriv hur du genomförde uppdraget..."
            value={aiDesc}
            onChange={e => setAiDesc(e.target.value)}
            disabled={thinking || verdict?.approved}
          />
          {thinking && (
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
          )}
          {verdict && (
            <div className={`quest-ai-verdict ${verdict.approved ? 'approved' : 'rejected'}`}>
              {verdict.approved ? '✓' : '✗'} {verdict.message}
            </div>
          )}
          {!verdict && !thinking && (
            <button
              className="complete-btn"
              onClick={handleAIValidate}
              disabled={!aiDesc.trim()}
            >
              VALIDERA MED AI
            </button>
          )}
        </div>
      )}

      {!isDone && (!needsAI || verdict?.approved) && (
        <button className="complete-btn" onClick={handleComplete}>
          SLUTFÖR
        </button>
      )}
    </div>
  );
}
