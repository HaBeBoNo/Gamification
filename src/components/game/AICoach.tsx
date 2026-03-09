import React, { useState } from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { refreshCoach } from '@/hooks/useAI';
import { RefreshCw } from 'lucide-react';
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
      <span className="coach-icon">🤖</span>
      <div className="coach-text">
        {loading ? (
          <CoachSkeleton />
        ) : (S.coachText || 'Din coach är redo. Skriv något.')}
      </div>
      <button className="coach-refresh" onClick={handleRefresh} disabled={loading}>
        <RefreshCw size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
        {loading ? '...' : 'UPPDATERA'}
      </button>
    </div>
  );
}
