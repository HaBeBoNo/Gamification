import React from 'react';
import { S } from '../state/store';

export default function ActivityFeed() {
  const feed = S.feed || [];
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">📜 AKTIVITET</div>
      </div>
      {feed.length === 0 ? (
        <div className="empty-state" style={{ padding:'24px 16px' }}>
          <div className="empty-icon" style={{ fontSize:'1.5rem' }}>💤</div>
          <div className="empty-text" style={{ fontSize:'0.78rem' }}>Ingen aktivitet ännu.</div>
        </div>
      ) : (
        <div className="feed-list">
          {feed.map((item, i) => (
            <div key={i} className="feed-item">
              <span className="feed-time">{item.t}</span>
              <span
                className="feed-text"
                style={item.color ? { color: item.color } : {}}
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
