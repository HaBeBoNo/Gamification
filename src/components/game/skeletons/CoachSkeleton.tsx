import React from 'react';

export default function CoachSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <div className="skeleton-pulse" style={{ width: '90%', height: 8, borderRadius: 4 }} />
      <div className="skeleton-pulse" style={{ width: '75%', height: 8, borderRadius: 4 }} />
      <div className="skeleton-pulse" style={{ width: '55%', height: 8, borderRadius: 4 }} />
    </div>
  );
}
