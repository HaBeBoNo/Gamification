import React, { useState, useEffect } from 'react';
import { S } from '@/state/store';
import { refreshCoach, DEFAULT_COACH_NAMES } from '@/hooks/useAI';
import { RefreshCw, Bot, MessageCircle, FileText } from 'lucide-react';
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
      <span className="coach-icon-wrap" title={coachName} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Bot size={20} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-accent)', lineHeight: 1 }}>{coachName}</span>
      </span>
      <div className="coach-text">
        {loading ? (
          <CoachSkeleton />
        ) : S.coachText ? (
          S.coachText
        ) : (
          <div className="empty-state" style={{ padding: 'var(--space-lg) 0' }}>
            <MessageCircle size={48} strokeWidth={1} />
            <div className="empty-text">Din coach är redo. Skriv något.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>
              <FileText size={14} style={{ color: 'var(--color-text-muted)' }} />
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>Relevanta dokument: Presskit, EP-plan</span>
            </div>
          </div>
        )}
      </div>
      <button className="coach-refresh" onClick={handleRefresh} disabled={loading || cooldown > 0} style={{ opacity: (loading || cooldown > 0) ? 0.5 : 1 }}>
        <RefreshCw size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
        {loading ? '...' : cooldown > 0 ? `${cooldown}s` : 'UPPDATERA'}
      </button>
    </div>
  );
}
