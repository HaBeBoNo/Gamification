import React from 'react';

export default function RefreshOverlay({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="overlay-backdrop">
      <div className="overlay-card">
        <div className="refresh-overlay-content">
          <div className="refresh-spinner" />
          <div className="ob-generating-text">{message}</div>
        </div>
      </div>
    </div>
  );
}
