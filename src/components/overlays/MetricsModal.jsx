import React, { useState } from 'react';
import { S, save } from '../../state/store';
import { awardMetricPts } from '../../hooks/useXP';

export default function MetricsModal({ onClose, rerender }) {
  const [vals, setVals] = useState({ ...S.metrics });

  function handleChange(key, val) {
    setVals(v => ({ ...v, [key]: Number(val) || 0 }));
  }

  function handleSave() {
    const deltas = {};
    Object.keys(vals).forEach(k => {
      deltas[k] = vals[k] - (S.metrics[k] || 0);
    });
    S.prev = { ...S.metrics };
    S.metrics = { ...vals };
    // Award metric pts to current user
    if (S.me) awardMetricPts(S.me, deltas);
    save();
    rerender();
    onClose();
  }

  const fields = [
    { key:'spf',  label:'Spotify Followers', icon:'🎵' },
    { key:'str',  label:'Streams',            icon:'▶️' },
    { key:'ig',   label:'Instagram',          icon:'📷' },
    { key:'x',    label:'Japan X',            icon:'🗾' },
    { key:'tix',  label:'Tickets',            icon:'🎟️' },
  ];

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card" onClick={e => e.stopPropagation()}>
        <button className="overlay-close" onClick={onClose}>✕</button>
        <div className="overlay-title">📊 Uppdatera Metrics</div>
        <div className="metrics-form">
          {fields.map(f => {
            const delta = vals[f.key] - (S.metrics[f.key] || 0);
            return (
              <div key={f.key} className="metrics-row">
                <span className="metrics-row-label">{f.icon} {f.label}</span>
                <input
                  type="number"
                  className="metrics-input"
                  value={vals[f.key]}
                  onChange={e => handleChange(f.key, e.target.value)}
                />
                {delta !== 0 && (
                  <span className={`metrics-delta-preview ${delta > 0 ? 'pos' : 'neg'}`}>
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <button className="complete-btn" onClick={handleSave}>SPARA</button>
      </div>
    </div>
  );
}
