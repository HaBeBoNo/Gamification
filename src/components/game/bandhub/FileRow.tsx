import { ExternalLink, File, FileText, Folder, Image, Music, Pin, Video } from 'lucide-react';
import { getCategory, getMimeTypeLabel, type DriveFile } from '@/lib/googleDrive';
import { formatFileSize, formatRelativeDriveDate } from '@/lib/bandHubSurface';
import { iconButtonStyle } from './styles';

function getMimeIcon(mimeType: string) {
  if (mimeType.includes('folder')) return <Folder size={16} />;
  if (mimeType.includes('document')) return <FileText size={16} />;
  if (mimeType.includes('audio')) return <Music size={16} />;
  if (mimeType.includes('video')) return <Video size={16} />;
  if (mimeType.includes('image')) return <Image size={16} />;
  return <File size={16} />;
}

export function FileRow({
  file,
  pinned,
  onTogglePin,
}: {
  file: DriveFile;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const category = getCategory(file);
  const categoryLabel = {
    inspelningar: 'Inspelning',
    dokument: 'Dokument',
    bilder: 'Bild',
    ovrigt: 'Övrigt',
  }[category];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      gap: 12,
      padding: '14px 14px',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      background: pinned ? 'color-mix(in srgb, var(--color-primary-muted) 50%, var(--color-surface-elevated))' : 'var(--color-surface-elevated)',
    }}>
      <a
        href={file.webViewLink}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          textDecoration: 'none',
          color: 'inherit',
          touchAction: 'manipulation',
        }}
        aria-label={`Öppna ${file.name}`}
      >
        <div style={{
          width: 38,
          height: 38,
          borderRadius: '12px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          flexShrink: 0,
        }}>
          {getMimeIcon(file.mimeType)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{
              fontSize: 'var(--text-micro)',
              color: pinned ? 'var(--color-primary)' : 'var(--color-text-muted)',
              background: pinned ? 'var(--color-primary-muted)' : 'var(--color-surface)',
              border: `1px solid ${pinned ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: '999px',
              padding: '2px 8px',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              {pinned ? 'Fäst' : categoryLabel}
            </span>
            <span style={{ fontSize: 'var(--text-micro)', color: 'var(--color-text-muted)' }}>
              {getMimeTypeLabel(file.mimeType)}
              {formatFileSize(file.size) ? ` · ${formatFileSize(file.size)}` : ''}
            </span>
          </div>

          <div style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-text)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 4,
          }}>
            {file.name}
          </div>

          <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
            {formatRelativeDriveDate(file.modifiedTime)}
          </div>
        </div>

        <div style={{
          width: 32,
          minHeight: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-subtle)',
          flexShrink: 0,
        }}>
          <ExternalLink size={14} />
        </div>
      </a>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button type="button"
          onClick={onTogglePin}
          style={iconButtonStyle}
          title={pinned ? 'Ta bort fästning' : 'Fäst fil'}
          aria-label={pinned ? 'Ta bort fästning' : 'Fäst fil'}
        >
          <Pin size={14} fill={pinned ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}
