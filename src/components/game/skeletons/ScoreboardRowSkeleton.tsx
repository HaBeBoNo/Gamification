import React from 'react';

export default function ScoreboardRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sb-row" style={{ opacity: 1 - i * 0.15 }}>
          <div className="sb-rank"><div className="skeleton-pulse" style={{ width: 16, height: 16, borderRadius: '50%' }} /></div>
          <div className="sb-member" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div className="skeleton-pulse" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-pulse" style={{ width: '65%', height: 12, borderRadius: 4, marginBottom: 4 }} />
              <div className="skeleton-pulse" style={{ width: '40%', height: 10, borderRadius: 4 }} />
            </div>
          </div>
          <div className="sb-pts"><div className="skeleton-pulse" style={{ width: 28, height: 12, borderRadius: 4, marginLeft: 'auto' }} /></div>
        </div>
      ))}
    </>
  );
}
