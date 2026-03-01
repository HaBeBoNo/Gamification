import React from 'react';

export default function RewardOverlay({ reward, tier, onClose }) {
  if (!reward) return null;
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card" onClick={e => e.stopPropagation()}>
        <button className="overlay-close" onClick={onClose}>✕</button>
        <div className="overlay-title">🎁 Belöning!</div>
        <span className={`rw-tier rw-tier-${tier || 'common'}`}>
          {(tier || 'common').toUpperCase()}
        </span>
        <div className="rw-text">{reward.text}</div>
        <div className="rw-flavor">{reward.flavor}</div>
        <button className="complete-btn" onClick={onClose}>
          HÄMTA IN
        </button>
      </div>
    </div>
  );
}
