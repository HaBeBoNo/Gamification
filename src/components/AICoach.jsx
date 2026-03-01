import React, { useState } from 'react';
import { S } from '../state/store';
import { MEMBERS } from '../data/members';
import { refreshCoach } from '../hooks/useAI';

export default function AICoach({ rerender }) {
  const [loading, setLoading] = useState(false);

  function handleRefresh() {
    setLoading(true);
    refreshCoach(S, MEMBERS, (text) => {
      S.coachText = text;
      setLoading(false);
      rerender();
    });
  }

  return (
    <div className="coach-bar">
      <span className="coach-icon">🤖</span>
      <div className="coach-text">
        {loading
          ? 'Hämtar coaching-insikt...'
          : (S.coachText || 'Klicka "UPPDATERA" för att få en coaching-insikt från din AI-coach.')}
      </div>
      <button className="coach-refresh" onClick={handleRefresh} disabled={loading}>
        {loading ? '...' : 'UPPDATERA'}
      </button>
    </div>
  );
}
