import React, { useState } from 'react';
import { Check } from 'lucide-react';

export default function DailyChallenge() {
  const [done] = useState(false);

  return (
    <div className={`dc-card ${done ? 'dc-done' : ''}`}>
      <div className="dc-top-row">
        <span className="dc-label">DAGENS UTMANING</span>
        <div className={`dc-ring ${done ? 'complete' : ''}`}>
          <svg width="24" height="24" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--color-border)" strokeWidth="2" />
            <circle
              cx="12" cy="12" r="10" fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeDasharray={2 * Math.PI * 10}
              strokeDashoffset={done ? 0 : 2 * Math.PI * 10}
              strokeLinecap="round"
              transform="rotate(-90 12 12)"
              style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
            />
          </svg>
        </div>
      </div>

      <div className="dc-body">
        <span className="dc-title">Dagens fokus</span>
        {done ? (
          <span className="dc-completed"><Check size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Avklarad</span>
        ) : (
          <span className="dc-desc">Välj ett uppdrag och genomför det med full närvaro idag.</span>
        )}
      </div>

      <div className="dc-footer">
        <span className="dc-reset">Nytt utmaning imorgon</span>
        <span className="dc-xp">50 XP</span>
      </div>
    </div>
  );
}
