import React from 'react';

export default function LevelUpOverlay({ level, onClose }) {
  if (!level) return null;
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card lu-overlay" onClick={e => e.stopPropagation()}>
        <div className="lu-label">LEVEL UP!</div>
        <div className="lu-level">{level}</div>
        <div className="overlay-subtitle">
          Du har nått en ny nivå. Fortsätt kämpa!
        </div>
        <button className="complete-btn" onClick={onClose}>
          FORTSÄTT
        </button>
      </div>
    </div>
  );
}
