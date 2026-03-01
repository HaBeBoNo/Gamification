import React from 'react';

export default function QuestModal({ quest, onClose }) {
  if (!quest) return null;
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card" onClick={e => e.stopPropagation()}>
        <button className="overlay-close" onClick={onClose}>✕</button>
        <div style={{ fontSize:'2rem' }}>{quest.icon}</div>
        <div className="overlay-title">{quest.title}</div>
        <div className="qm-desc">{quest.desc}</div>
        <div className="qm-meta">
          <span className="quest-xp">⚡ {quest.xp} XP</span>
          {quest.recur && <span className="quest-recur">{quest.recur}</span>}
          {quest.region && quest.region !== 'all' && (
            <span className="quest-region">{quest.region}</span>
          )}
        </div>
        <button className="complete-btn" onClick={onClose}>STÄNG</button>
      </div>
    </div>
  );
}
