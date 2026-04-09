import React, { useEffect, useRef, useState } from 'react';
import { S } from '@/state/store';
import { Camera, Globe2, Music2, Play, Ticket } from 'lucide-react';

const METRICS = [
  { key: 'spf', label: 'Spotify',   icon: Music2 },
  { key: 'str', label: 'Streams',   icon: Play },
  { key: 'ig',  label: 'Instagram', icon: Camera },
  { key: 'x',   label: 'Japan X',   icon: Globe2 },
  { key: 'tix', label: 'Tickets',   icon: Ticket },
];

function formatMetric(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
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
}

export default function MetricsBar({ onMetricClick }: MetricsBarProps) {
  const pts = S.metrics || {};

  return (
    <div style={{
      margin: '0 var(--space-md) var(--space-md)',
      display: 'flex',
      gap: 'var(--space-sm)',
      overflowX: 'auto',
      paddingBottom: 4,
      scrollbarWidth: 'none',
    }}>
      {METRICS.map((m) => {
        const Icon = m.icon;
        return (
        <div
          key={m.key}
          onClick={() => onMetricClick?.()}
          style={{
            flex: '0 0 auto',
            background: 'var(--color-surface-elevated)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-sm) var(--space-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 80,
            cursor: onMetricClick ? 'pointer' : 'default',
          }}
        >
          <span style={{ color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center' }}>
            <Icon size={16} strokeWidth={1.9} />
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-body)',
            color: 'var(--color-text)',
            fontWeight: 600,
          }}>
            <AnimatedNumber value={pts[m.key] ?? 0} format={formatMetric} />
          </span>
          <span style={{
            fontSize: 'var(--text-micro)',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {m.label}
          </span>
        </div>
        );
      })}
    </div>
  );
}
