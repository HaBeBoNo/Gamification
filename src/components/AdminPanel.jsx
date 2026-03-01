import React, { useState } from 'react';
import { S, save, defChar } from '../state/store';
import { MEMBERS } from '../data/members';
import { BASE_QUESTS } from '../data/quests';

export default function AdminPanel({ rerender, onClose }) {
  const [xpTarget, setXpTarget] = useState('');
  const [xpAmount, setXpAmount] = useState('');
  const [opName, setOpName] = useState(S.operationName || '');
  const [metrics, setMetrics] = useState({
    spf: S.metrics.spf,
    str: S.metrics.str,
    ig:  S.metrics.ig,
    x:   S.metrics.x,
    tix: S.metrics.tix,
  });
  const [saved, setSaved] = useState(false);

  function handleReset() {
    if (!confirm('Återställ ALL data? Detta kan inte ångras.')) return;
    localStorage.removeItem('sek-v6');
    window.location.reload();
  }

  function handleAddXP() {
    const id = xpTarget || S.me;
    const amount = parseInt(xpAmount) || 0;
    if (!id || !amount) return;
    if (!S.chars[id]) S.chars[id] = defChar(id);
    S.chars[id].xp += amount;
    S.chars[id].totalXp += amount;
    save();
    rerender();
    setXpAmount('');
  }

  function handleExport() {
    const data = localStorage.getItem('sek-v6') || '{}';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sektionen-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          JSON.parse(ev.target.result); // validate
          localStorage.setItem('sek-v6', ev.target.result);
          window.location.reload();
        } catch {
          alert('Ogiltig fil');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleResetQuests() {
    S.quests = BASE_QUESTS.map(q => ({ ...q, done: false, aiVerdict: null, personal: false }));
    save();
    rerender();
  }

  function handleSaveOpName() {
    S.operationName = opName;
    save();
    rerender();
  }

  function delta(key) {
    const diff = metrics[key] - (S.prev?.[key] ?? S.metrics[key]);
    if (diff === 0) return null;
    return { value: diff > 0 ? `+${diff}` : `${diff}`, positive: diff > 0 };
  }

  function saveMetrics() {
    S.prev    = { ...S.metrics };
    S.metrics = { ...S.metrics, ...metrics };
    const ts  = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    S.feed.push({ who: S.me, action: 'uppdaterade metrics', xp: 0, time: ts });
    save();
    rerender();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <button className="overlay-close" onClick={onClose}>✕</button>
        <div className="overlay-title">⚙️ Admin Panel</div>

        <div className="admin-panel">
          <div className="admin-section-title">Operation</div>
          <div className="admin-row">
            <input
              className="admin-input"
              value={opName}
              onChange={e => setOpName(e.target.value)}
              placeholder="Operation namn..."
            />
            <button className="admin-btn" onClick={handleSaveOpName}>SPARA</button>
          </div>

          <div className="admin-section-title">XP</div>
          <div className="admin-row">
            <select
              className="admin-input"
              value={xpTarget}
              onChange={e => setXpTarget(e.target.value)}
              style={{ flex: 0, minWidth: 120 }}>
              <option value="">Välj spelare</option>
              {Object.entries(MEMBERS).map(([id, m]) => (
                <option key={id} value={id}>{m.name}</option>
              ))}
            </select>
            <input
              className="admin-input"
              type="number"
              placeholder="XP-mängd"
              value={xpAmount}
              onChange={e => setXpAmount(e.target.value)}
              style={{ flex: 0, width: 100 }}
            />
            <button className="admin-btn" onClick={handleAddXP}>LÄGG TILL XP</button>
          </div>

          <div className="admin-section-title">Uppdrag</div>
          <div className="admin-row">
            <button className="admin-btn" onClick={handleResetQuests}>ÅTERSTÄLL UPPDRAG</button>
          </div>

          <div className="admin-section-title">Data</div>
          <div className="admin-row">
            <button className="admin-btn" onClick={handleExport}>EXPORTERA</button>
            <button className="admin-btn" onClick={handleImport}>IMPORTERA</button>
            <button className="admin-btn danger" onClick={handleReset}>FULL RESET</button>
          </div>

          {(S.me === 'hannes' || S.me === 'nisse') && (
            <div className="admin-metrics-form">
              <div className="admin-section-title">Uppdatera metrics</div>

              {[
                { key: 'spf', label: 'Spotify followers' },
                { key: 'str', label: 'Spotify streams totalt' },
                { key: 'ig',  label: 'Instagram followers' },
                { key: 'x',   label: 'X / Twitter followers' },
                { key: 'tix', label: 'Biljetter' },
              ].map(({ key, label }) => {
                const d = delta(key);
                return (
                  <div key={key} className="admin-metrics-field">
                    <label className="admin-metrics-label">{label}</label>
                    <input
                      type="number"
                      className="admin-input"
                      value={metrics[key]}
                      onChange={e => setMetrics(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                    />
                    {d && (
                      <span className={d.positive ? 'delta-pos' : 'delta-neg'}>{d.value} sedan senast</span>
                    )}
                  </div>
                );
              })}

              <button className="admin-btn admin-metrics-save-btn" onClick={saveMetrics}>Spara metrics</button>

              {saved && <span className="metrics-saved-msg">Metrics sparade ✓</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}