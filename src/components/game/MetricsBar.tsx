import React, { useEffect, useRef, useState } from 'react';
import { S } from '@/state/store';
import { Music, Play, Camera, Video, Ticket, Zap } from 'lucide-react';

const METRIC_DEFS = [
  { key: 'spf', label: 'Spotify Followers', Icon: Music },
  { key: 'str', label: 'Streams', Icon: Play },
  { key: 'ig', label: 'Instagram', Icon: Camera },
  { key: 'x', label: 'TikTok', Icon: Video },
  { key: 'tix', label: 'Biletto', Icon: Ticket },
];

function formatVal(key: string, val: number) {
  if (key === 'str' && val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return String(val);
}

function AnimatedNumber({ value, format }: { value: number; format: (v: number) => string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    prevRef.current = to;
    const start = performance.now();
    const duration = 400;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);

  return <span>{format(display)}</span>;
}

interface MetricsBarProps {
  onMetricClick?: () => void;
  rerender: () => void;
}

export default function MetricsBar({ onMetricClick }: MetricsBarProps) {
  const metrics = S.metrics || {};
  const prev = S.prev || {};
  const totalXP = Object.values(S.chars || {}).reduce((sum: number, c: any) => sum + (c.totalXp || 0), 0);

  const visibleMetrics = METRIC_DEFS.filter(def => {
    if (def.key === 'tix') {
      const val = metrics[def.key] || 0;
      const prevVal = prev[def.key] || 0;
      if (val === 0 && prevVal === 0) return false;
    }
    return true;
  });

  return (
    <div className="metrics-strip">
      {visibleMetrics.map(def => {
        const val = metrics[def.key] || 0;
        const prevVal = prev[def.key] || 0;
        const delta = val - prevVal;
        const hasDelta = prevVal !== 0 || delta !== 0;
        const Icon = def.Icon;
        return (
          <div key={def.key} className="metrics-strip-item" onClick={() => onMetricClick?.()} title={`${def.label}: ${formatVal(def.key, val)}`}>
            <Icon size={14} strokeWidth={1.5} className="metrics-strip-icon" />
            <span className="metrics-strip-val">
              <AnimatedNumber value={val} format={(v) => formatVal(def.key, v)} />
            </span>
            {hasDelta && delta !== 0 && (
              <span className={`metrics-strip-delta ${delta > 0 ? 'up' : 'down'}`}>
                {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
              </span>
            )}
            {hasDelta && delta === 0 && (
              <span className="metrics-strip-delta flat">→</span>
            )}
          </div>
        );
      })}
      <div className="metrics-strip-item" onClick={() => onMetricClick?.()} title={`Guild XP: ${totalXP}`}>
        <Zap size={14} strokeWidth={1.5} className="metrics-strip-icon" />
        <span className="metrics-strip-val">
          <AnimatedNumber value={totalXP} format={(v) => String(v)} />
        </span>
      </div>
    </div>
  );
}
