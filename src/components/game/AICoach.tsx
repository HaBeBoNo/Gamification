import React, { useState, useEffect } from 'react';
import { S } from '@/state/store';
import { refreshCoach, DEFAULT_COACH_NAMES } from '@/hooks/useAI';
import { RefreshCw, Bot, MessageCircle } from 'lucide-react';
import CoachSkeleton from './skeletons/CoachSkeleton';

export default function AICoach({ rerender }: { rerender: () => void }) {
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  let coachName: string = 'Coach';
  if (S.me) {
    coachName = (S.chars[S.me]?.coachName || DEFAULT_COACH_NAMES[S.me] || 'Coach') as string;
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleRefresh() {
    if (loading || cooldown > 0) return;
    setLoading(true);
    try {
      const text = await refreshCoach();
      S.coachText = text;
      setCooldown(30);
      rerender();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="coach-bar">
      <div className="coach-bar-top">
        <div className="coach-identity">
          <span className="coach-icon-wrap" title={coachName}>
            <Bot size={18} />
          </span>
          <div className="coach-meta">
            <span className="coach-label">{coachName}</span>
            <span className="coach-caption">Scout</span>
          </div>
        </div>
        <button type="button" className="coach-refresh" onClick={handleRefresh} disabled={loading || cooldown > 0} style={{ opacity: (loading || cooldown > 0) ? 0.5 : 1 }}>
          <RefreshCw size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
          {loading ? '...' : cooldown > 0 ? `${cooldown}s` : 'UPPDATERA'}
        </button>
      </div>
      <div className="coach-text">
        {loading ? (
          <CoachSkeleton />
        ) : S.coachText ? (
          S.coachText
        ) : (
          <div className="coach-empty">
            <MessageCircle size={16} strokeWidth={1.8} />
            <span>Scout är redo när du vill be om nästa steg.</span>
          </div>
        )}
      </div>
    </div>
  );
}
