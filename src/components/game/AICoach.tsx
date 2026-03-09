import React, { useState } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { refreshCoach } from '@/hooks/useAI';
import { RefreshCw, Bot, MessageCircle, FileText } from 'lucide-react';
import CoachSkeleton from './skeletons/CoachSkeleton';

export default function AICoach({ rerender }: { rerender: () => void }) {
  const [loading, setLoading] = useState(false);

  async function handleRefresh() {
    setLoading(true);
    const text = await refreshCoach();
    S.coachText = text;
    setLoading(false);
    rerender();
  }

  return (
    <div className="coach-bar">
      <span className="coach-icon-wrap">
        <Bot size={20} />
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
      <button className="coach-refresh" onClick={handleRefresh} disabled={loading}>
        <RefreshCw size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
        {loading ? '...' : 'UPPDATERA'}
      </button>
    </div>
  );
}
