import React from 'react';
import { S } from '@/state/store';
import { ScrollText } from 'lucide-react';

export default function ActivityFeed() {
  const feed = S.feed || [];
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <ScrollText size={14} strokeWidth={2} />
          AKTIVITET
        </div>
      </div>
      {feed.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-xl) var(--space-lg)' }}>
          <ScrollText size={28} strokeWidth={1} style={{ opacity: 0.25 }} />
          <div className="empty-text">Ingen aktivitet ännu.</div>
        </div>
      ) : (
        <div className="feed-list">
          {feed.map((item: any, i: number) => (
            <div key={i} className="feed-item">
              <span className="feed-time">{item.t}</span>
              <span className="feed-text" style={item.color ? { color: item.color } : {}}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
