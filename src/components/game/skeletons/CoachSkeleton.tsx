import React from 'react';

export default function CoachSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <div className="skeleton-pulse" style={{ width: '92%', height: 14, borderRadius: 4 }} />
      <div className="skeleton-pulse" style={{ width: '78%', height: 14, borderRadius: 4 }} />
      <div className="skeleton-pulse" style={{ width: '60%', height: 14, borderRadius: 4 }} />
    </div>
  );
}
