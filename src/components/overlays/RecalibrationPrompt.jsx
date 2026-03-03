import React, { useState } from 'react';
import { S, save } from '../../state/store';

export default function RecalibrationPrompt({ weeksSince, onClose }) {
  const [text, setText] = useState('');

  function handleSave() {
    if (!S.me || !S.chars[S.me]) return;
    S.chars[S.me].recalibration = text.trim();
    S.chars[S.me].recalibratedWeek = weeksSince;
    save();
    onClose();
  }

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card" onClick={e => e.stopPropagation()}>
        <button className="overlay-close" onClick={onClose}>✕</button>
        <div className="overlay-title" style={{ fontSize:'1rem', marginBottom:12 }}>
          Något har förändrats sedan du loggade in första gången. Vad?
        </div>
        <textarea
          className="ob-input"
          placeholder="Skriv fritt — det behöver inte vara stort."
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
        />
        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <button className="complete-btn" style={{ opacity:0.4 }} onClick={onClose}>
            HOPPA ÖVER
          </button>
          <button
            className="complete-btn"
            onClick={handleSave}
            disabled={text.trim().length < 3}
          >
            SPARA →
          </button>
        </div>
      </div>
    </div>
  );
}
