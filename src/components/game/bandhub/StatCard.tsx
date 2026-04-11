import type React from 'react';

export function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div style={{
      background: 'var(--color-surface-elevated)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      padding: '14px 12px',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', marginBottom: 10 }}>
        {icon}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-micro)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 'var(--text-body)',
        color: 'var(--color-text)',
        fontWeight: 600,
        marginBottom: 4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
        {detail}
      </div>
    </div>
  );
}
