import React, { useState, useEffect, useRef } from 'react';
import { Upload, ExternalLink, Folder, FileText, Music, Video, Image, File, RefreshCw } from 'lucide-react';
import { getDriveFiles, uploadFile, getMimeTypeLabel, formatDate } from '@/lib/googleDrive';
import { S } from '@/state/store';

const PINNED_IDS_KEY = 'sektionen_pinned_files';

function getMimeIcon(mimeType: string) {
  if (mimeType.includes('folder')) return <Folder size={16} />;
  if (mimeType.includes('document')) return <FileText size={16} />;
  if (mimeType.includes('audio')) return <Music size={16} />;
  if (mimeType.includes('video')) return <Video size={16} />;
  if (mimeType.includes('image')) return <Image size={16} />;
  return <File size={16} />;
}

export default function BandHub() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(PINNED_IDS_KEY) || '[]');
    } catch { return []; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = S.me === 'hannes';

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    setLoading(true);
    setError('');
    try {
      const result = await getDriveFiles();
      setFiles(result);
    } catch {
      setError('Kunde inte hämta filer. Kontrollera att du är inloggad med rätt Google-konto.');
    } finally {
      setLoading(false);
    }
  }

  function togglePin(id: string) {
    const updated = pinnedIds.includes(id)
      ? pinnedIds.filter(p => p !== id)
      : [...pinnedIds, id];
    setPinnedIds(updated);
    localStorage.setItem(PINNED_IDS_KEY, JSON.stringify(updated));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadSuccess('');
    try {
      await uploadFile(file);
      setUploadSuccess(`${file.name} uppladdad!`);
      await loadFiles();
    } catch {
      setError('Uppladdning misslyckades.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const pinnedFiles = files.filter(f => pinnedIds.includes(f.id));
  const recentFiles = files.filter(f => !pinnedIds.includes(f.id));

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 48, color: 'var(--color-text-muted)', fontSize: 13,
        fontFamily: 'var(--font-ui)',
      }}>
        Hämtar filer...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
        <button
          onClick={loadFiles}
          style={{
            background: 'var(--color-primary)', color: '#fff',
            border: 'none', borderRadius: '999px',
            padding: '10px 20px', fontSize: 13,
            fontFamily: 'var(--font-ui)', cursor: 'pointer',
          }}
        >
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 100px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '16px 0',
      }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.1em',
          color: 'var(--color-text-muted)', fontFamily: 'var(--font-ui)',
        }}>
          SEKTIONEN DRIVE
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={loadFiles}
            style={{
              background: 'none', border: 'none',
              color: 'var(--color-text-muted)', cursor: 'pointer',
              padding: 4, touchAction: 'manipulation',
            }}
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--color-primary)', color: '#fff',
              border: 'none', borderRadius: '999px',
              padding: '8px 14px', fontSize: 12,
              fontFamily: 'var(--font-ui)', cursor: 'pointer',
              touchAction: 'manipulation', opacity: uploading ? 0.7 : 1,
            }}
          >
            <Upload size={14} />
            {uploading ? 'Laddar upp...' : 'Ladda upp'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
        </div>
      </div>

      {uploadSuccess && (
        <div style={{
          background: 'var(--color-accent)20',
          border: '1px solid var(--color-accent)40',
          borderRadius: 8, padding: '10px 14px',
          fontSize: 13, color: 'var(--color-accent)',
          marginBottom: 16,
        }}>
          ✓ {uploadSuccess}
        </div>
      )}

      {/* Fästa filer */}
      {pinnedFiles.length > 0 && (
        <>
          <div style={{
            fontSize: 11, letterSpacing: '0.1em',
            color: 'var(--color-text-muted)', fontFamily: 'var(--font-ui)',
            marginBottom: 8,
          }}>
            FÄSTA
          </div>
          <div style={{ marginBottom: 20 }}>
            {pinnedFiles.map(file => (
              <FileRow
                key={file.id}
                file={file}
                pinned={true}
                isAdmin={isAdmin}
                onTogglePin={() => togglePin(file.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Senaste filer */}
      <div style={{
        fontSize: 11, letterSpacing: '0.1em',
        color: 'var(--color-text-muted)', fontFamily: 'var(--font-ui)',
        marginBottom: 8,
      }}>
        SENASTE
      </div>
      <div>
        {recentFiles.length === 0 && (
          <div style={{
            color: 'var(--color-text-muted)', fontSize: 13,
            textAlign: 'center', padding: 32,
          }}>
            Inga filer hittades i Sektionen-mappen.
          </div>
        )}
        {recentFiles.map(file => (
          <FileRow
            key={file.id}
            file={file}
            pinned={false}
            isAdmin={isAdmin}
            onTogglePin={() => togglePin(file.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FileRow({ file, pinned, isAdmin, onTogglePin }: {
  file: any;
  pinned: boolean;
  isAdmin: boolean;
  onTogglePin: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      gap: 12, padding: '12px 0',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
        {getMimeIcon(file.mimeType)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, color: 'var(--color-text)',
          fontWeight: 500, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {file.name}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--color-text-muted)',
          marginTop: 2,
        }}>
          {getMimeTypeLabel(file.mimeType)} · {formatDate(file.modifiedTime)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {isAdmin && (
          <button
            onClick={onTogglePin}
            style={{
              background: 'none', border: 'none',
              color: pinned ? 'var(--color-primary)' : 'var(--color-text-muted)',
              cursor: 'pointer', fontSize: 16,
              touchAction: 'manipulation', padding: 4,
            }}
            title={pinned ? 'Ta bort fästning' : 'Fäst fil'}
          >
            {pinned ? '★' : '☆'}
          </button>
        )}
        <a
          href={file.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--color-text-muted)',
            display: 'flex', alignItems: 'center',
            padding: 4,
          }}
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}