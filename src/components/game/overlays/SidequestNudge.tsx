import React from 'react';
import { S, save } from '@/state/store';
import { X, Zap } from 'lucide-react';

export default function SidequestNudge({ quests, onClose, rerender }: { quests: any[]; onClose: () => void; rerender: () => void }) {
  if (!quests || quests.length === 0) return null;

  function acceptAll() {
    quests.forEach((q: any) => {
      if (!S.quests.find((sq: any) => sq.id === q.id)) {
        S.quests.push({ ...q, done: false, aiVerdict: null });
      }
    });
    save();
    rerender();
    onClose();
  }

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card" onClick={e => e.stopPropagation()}>
        <button className="overlay-close" onClick={onClose}><X size={14} /></button>
        <div className="overlay-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <Zap size={20} strokeWidth={2} />
          Sidequest-förslag
        </div>
        <div className="overlay-subtitle">AI-coachen föreslår dessa extra uppdrag för veckan.</div>
        <div className="nudge-quests">
          {quests.map((q: any, i: number) => (
            <div key={i} className="nudge-quest-row">
              <span className="nudge-quest-icon">{q.icon || '⚡'}</span>
              <div>
                <div className="nudge-quest-title">{q.title}</div>
                <div className="quest-desc">{q.desc}</div>
              </div>
              <span className="nudge-quest-xp">+{q.xp} XP</span>
            </div>
          ))}
        </div>
        <button className="nudge-accept-btn" onClick={acceptAll}>ACCEPTERA ALLA</button>
      </div>
    </div>
  );
}
