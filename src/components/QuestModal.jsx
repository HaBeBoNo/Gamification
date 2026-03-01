import React, { useState } from 'react';

/**
 * QuestModal
 * Props:
 *   quest      — the quest object
 *   onClose    — () => void
 *   onComplete — (quest, reflection) => void   (standard/hidden/ghost)
 *   onValidate — (quest, reflection) => void   (strategic)
 */
export default function QuestModal({ quest, onClose, onComplete, onValidate }) {
  const [reflection, setReflection] = useState('');

  if (!quest) return null;

  const isStrategic = quest.type === 'strategic';

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card quest-modal" onClick={e => e.stopPropagation()}> 
        <h3>{quest.title}</h3>
        <p className="quest-modal-desc">{quest.desc}</p>

        <textarea
          placeholder={
            isStrategic
              ? 'Beskriv vad du faktiskt gjorde — AI-coachen bedömer och justerar XP'
              : 'Kort reflektion — vad gjorde du? (valfritt, men AI-coachen lär sig)'
          }
          value={reflection}
          onChange={e => setReflection(e.target.value)}
          rows={isStrategic ? 5 : 3}
        />

        {isStrategic && (
          <p className="quest-modal-hint">
            Strategiska uppdrag bedöms av AI. Mer detaljerat svar = mer XP.
          </p>
        )}

        <div className="quest-modal-actions">
          <button className="btn-cancel" onClick={onClose}>Avbryt</button>
          {isStrategic ? (
            <button
              className="btn-confirm"
              disabled={reflection.trim().length < 10}
              onClick={() => onValidate(quest, reflection)}
            >
              Skicka till AI-coach ✓
            </button>
          ) : (
            <button
              className="btn-confirm"
              onClick={() => onComplete(quest, reflection)}
            >
              Slutför uppdrag ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}