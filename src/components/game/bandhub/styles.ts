import type React from 'react';

export const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: '40px',
  background: 'var(--color-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: '999px',
  padding: '0 14px',
  fontSize: '12px',
  fontFamily: 'var(--font-ui)',
  letterSpacing: '0.06em',
  cursor: 'pointer',
  touchAction: 'manipulation',
};

export const iconButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-surface-elevated)',
  color: 'var(--color-text-muted)',
  border: '1px solid var(--color-border)',
  borderRadius: '12px',
  cursor: 'pointer',
  touchAction: 'manipulation',
};

export const emptyCardStyle: React.CSSProperties = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-card)',
  padding: '24px 18px',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-caption)',
  lineHeight: 1.55,
};
