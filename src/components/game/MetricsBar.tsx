import React from 'react';
import { S } from '@/state/store';

const METRIC_DEFS = [
  { key: 'spf', label: 'SPOTIFY', icon: '🎵' },
  { key: 'str', label: 'STREAMS', icon: '▶️' },
  { key: 'ig', label: 'INSTAGRAM', icon: '📷' },
  { key: 'x', label: 'JAPAN X', icon: '🗾' },
  { key: 'tix', label: 'TICKETS', icon: '🎟️' },
];

function formatVal(key: string, val: number) {
  if (key === 'str' && val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val;
}

function deltaClass(d: number) {
  if (d > 0) return 'pos';
  if (d < 0) return 'neg';
  return 'neu';
}

function deltaText(d: number) {
  if (d > 0) return '↑' + d;
  if (d < 0) return '↓' + Math.abs(d);
  return '—';
}

interface MetricsBarProps {
  onMetricClick?: () => void;
  rerender: () => void;
}

export default function MetricsBar({ onMetricClick }: MetricsBarProps) {
  const metrics = S.metrics || {};
  const prev = S.prev || {};
  const totalXP = Object.values(S.chars || {}).reduce((sum: number, c: any) => sum + (c.totalXp || 0), 0);

  return (
    <div className="metrics-bar">
      {METRIC_DEFS.map(def => {
        const val = metrics[def.key] || 0;
        const prevVal = prev[def.key] || 0;
        const delta = val - prevVal;
        return (
          <div key={def.key} className="metric-card" onClick={() => onMetricClick?.()}>
            <span className="metric-icon">{def.icon}</span>
            <span className="metric-val">{formatVal(def.key, val)}</span>
            <span className="metric-label">{def.label}</span>
            <span className={`metric-delta ${deltaClass(delta)}`}>{deltaText(delta)}</span>
          </div>
        );
      })}
      <div className="metric-card">
        <span className="metric-icon">⚔️</span>
        <span className="metric-val">{totalXP}</span>
        <span className="metric-label">GUILD XP</span>
        <span className="metric-delta neu">—</span>
      </div>
    </div>
  );
}
