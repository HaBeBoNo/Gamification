import React from 'react';

export default function QuestCardSkeleton() {
  return (
    <div className="quest-card skeleton-card">
      <div className="quest-card-head">
        <div className="skeleton-pulse" style={{ width: 10, height: 10, borderRadius: '50%' }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton-pulse" style={{ width: '40%', height: 12, borderRadius: 4, marginBottom: 6 }} />
          <div className="skeleton-pulse" style={{ width: '75%', height: 14, borderRadius: 4 }} />
        </div>
      </div>
      <div className="skeleton-pulse" style={{ width: '90%', height: 12, borderRadius: 4, marginTop: 'var(--space-md)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-md)' }}>
        <div className="skeleton-pulse" style={{ width: '30%', height: 10, borderRadius: 4 }} />
        <div className="skeleton-pulse" style={{ width: 50, height: 10, borderRadius: 4 }} />
      </div>
    </div>
  );
}
