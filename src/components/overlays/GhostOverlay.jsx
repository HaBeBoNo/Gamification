import React from 'react';
import { S, save } from '../../state/store';
import { awardXP } from '../../hooks/useXP';

export default function GhostOverlay({ quest, onClose, rerender, showLU, showRW }) {
  if (!quest) return null;

  const expiresAt = quest.expires ? Date.now() + quest.expires : null;
  const expiresText = expiresAt
    ? `Upphör: ${new Date(expiresAt).toLocaleString('sv-SE')}`
    : 'Begränsad tid';

  function handleComplete() {
    const q = { ...quest, done: true };
    const idx = S.quests.findIndex(sq => sq.id === quest.id);
    if (idx >= 0) {
      S.quests[idx] = q;
    } else {
      S.quests.push(q);
    }
    awardXP(quest, quest.xp || 150, null, S, save, rerender,
      null,
      (level) => showLU?.(level),
      (reward, tier) => showRW?.(reward, tier),
    );
    save();
    rerender();
    onClose();
  }

  return (
    <div className="overlay-backdrop ghost-overlay" onClick={onClose}>
      <div className="overlay-card" onClick={e => e.stopPropagation()}>
        <button className="overlay-close" onClick={onClose}>✕</button>
        <div style={{ fontSize:'2.5rem' }}>{quest.icon || '👻'}</div>
        <div className="ghost-title">{quest.title}</div>
        <div className="overlay-subtitle">{quest.desc}</div>
        <div className="ghost-expires">{expiresText}</div>
        <div className="qm-meta">
          <span className="quest-xp">⚡ {quest.xp} XP</span>
        </div>
        <button className="complete-btn" onClick={handleComplete}>
          ACCEPTERA UPPDRAGET
        </button>
      </div>
    </div>
  );
}
