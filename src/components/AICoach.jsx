import React, { useState, useEffect } from 'react';
import { S, save } from '../state/store';
import { refreshCoach } from '../hooks/useAI';

export default function AICoach({ rerender }) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState(S.coachText || '');

  useEffect(() => {
    if (!S.coachText) {
      handleRefresh();
    }
  }, []);

  async function handleRefresh() {
    setLoading(true);
    try {
      const result = await refreshCoach();
      S.coachText = result;
      setText(result);
      if (S.me && S.chars[S.me]) {
        const log = S.chars[S.me].coachLog || [];
        log.push({ text: result, ts: Date.now(), week: S.weekNum || 0 });
        if (log.length > 10) log.splice(0, log.length - 10);
        S.chars[S.me].coachLog = log;
        save();
      }
    } catch {
      // keep existing text
    }
    setLoading(false);
    rerender?.();
  }

  return (
    <div className="coach-bar">
      <span className="coach-icon">🤖</span>
      <div className="coach-text">
        {loading
          ? 'Hämtar coaching-insikt...'
          : (text || 'Klicka "UPPDATERA" för att få en coaching-insikt från din AI-coach.')}
      </div>
      <button className="coach-refresh" onClick={handleRefresh} disabled={loading}>
        {loading ? '...' : 'UPPDATERA'}
      </button>
    </div>
  );
}