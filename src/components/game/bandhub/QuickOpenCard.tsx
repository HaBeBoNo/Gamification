import type React from 'react';
import type { DriveFile } from '@/lib/googleDrive';
import { formatRelativeDriveDate } from '@/lib/bandHubSurface';

export function QuickOpenCard({
  icon,
  eyebrow,
  file,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  file: DriveFile;
}) {
  return (
    <a
      href={file.webViewLink}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
        padding: '14px 12px',
        background: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
        {icon}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-micro)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {eyebrow}
        </span>
      </div>
      <div style={{
        fontSize: 'var(--text-body)',
        color: 'var(--color-text)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {file.name}
      </div>
      <div style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
        {formatRelativeDriveDate(file.modifiedTime)}
      </div>
    </a>
  );
}
