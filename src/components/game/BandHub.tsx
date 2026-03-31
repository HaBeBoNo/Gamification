import React, { useState, useEffect } from 'react';
import { Music, FileText, Image, File, CloudOff } from 'lucide-react';
import { getDriveFiles, getCategory, DriveFile } from '@/lib/googleDrive';
import CalendarView from './CalendarView';

const TABS = [
  { id: 'kalender', label: 'KALENDER' },
  { id: 'drive', label: 'DRIVE' },
];

const CATEGORIES = [
  { id: 'alla', label: 'Alla' },
  { id: 'inspelningar', label: 'Inspelningar' },
  { id: 'dokument', label: 'Dokument' },
  { id: 'bilder', label: 'Bilder' },
  { id: 'ovrigt', label: 'Övrigt' },
];

function getCategoryIcon(cat: string, size = 16) {
  switch (cat) {
    case 'inspelningar': return <Music size={size} />;
    case 'dokument': return <FileText size={size} />;
    case 'bilder': return <Image size={size} />;
    default: return <File size={size} />;
  }
}

function getCategoryColor(cat: string): string {
  switch (cat) {
    case 'inspelningar': return 'var(--color-accent)';
    case 'dokument': return 'var(--color-primary)';
    case 'bilder': return 'var(--color-warning)';
    default: return 'var(--color-text-secondary)';
  }
}

function formatModifiedDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const fileDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (fileDay.getTime() === today.getTime()) return 'Idag';
  if (fileDay.getTime() === yesterday.getTime()) return 'Igår';
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function formatSize(size?: string): string {
  if (!size) return '';
  const bytes = parseInt(size, 10);
  if (isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SkeletonRow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0', borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: 4,
        background: 'var(--color-border)',
        animation: 'pulse 1.5s ease-in-out infinite',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{
          height: 14, width: '60%', borderRadius: 4,
          background: 'var(--color-border)',
          animation: 'pulse 1.5s ease-in-out infinite',
          marginBottom: 6,
        }} />
        <div style={{
          height: 11, width: '30%', borderRadius: 4,
          background: 'var(--color-border)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>
      <div style={{
        height: 11, width: 60, borderRadius: 4,
        background: 'var(--color-border)',
        animation: 'pulse 1.5s ease-in-out infinite',
        flexShrink: 0,
      }} />
    </div>
  );
}

export default function BandHub() {
  const [activeTab, setActiveTab] = useState('kalender');
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveError, setDriveError] = useState(false);
  const [driveCategory, setDriveCategory] = useState<string>('alla');

  useEffect(() => {
    if (activeTab !== 'drive') return;
    setDriveLoading(true);
    setDriveError(false);
    getDriveFiles()
      .then(files => {
        setDriveFiles(files);
        setDriveLoading(false);
      })
      .catch(() => {
        setDriveError(true);
        setDriveLoading(false);
      });
  }, [activeTab]);

  function retryLoad() {
    setDriveLoading(true);
    setDriveError(false);
    getDriveFiles()
      .then(files => {
        setDriveFiles(files);
        setDriveLoading(false);
      })
      .catch(() => {
        setDriveError(true);
        setDriveLoading(false);
      });
  }

  const filteredFiles = driveCategory === 'alla'
    ? driveFiles
    : driveFiles.filter(f => getCategory(f) === driveCategory);

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--color-border)',
        padding: '0 16px',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.id
                ? '2px solid var(--color-primary)'
                : '2px solid transparent',
              color: activeTab === tab.id
                ? 'var(--color-primary)'
                : 'var(--color-text-muted)',
              fontSize: 11, letterSpacing: '0.1em',
              fontFamily: 'var(--font-ui)',
              padding: '12px 16px',
              cursor: 'pointer',
              touchAction: 'manipulation',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'kalender' && <CalendarView />}

      {activeTab === 'drive' && (
        <div style={{ padding: '0 16px 100px' }}>

          {/* Header */}
          <div style={{
            fontSize: 11, letterSpacing: '0.1em',
            color: 'var(--color-text-muted)', fontFamily: 'var(--font-ui)',
            padding: '16px 0 12px',
          }}>
            SEKTIONEN DRIVE
          </div>

          {/* Category filter pills */}
          <div style={{
            display: 'flex', gap: 8, flexWrap: 'wrap',
            marginBottom: 16,
          }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setDriveCategory(cat.id)}
                style={{
                  background: driveCategory === cat.id
                    ? 'var(--color-primary)'
                    : 'transparent',
                  color: driveCategory === cat.id
                    ? '#fff'
                    : 'var(--color-text-muted)',
                  border: `1px solid ${driveCategory === cat.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: '999px',
                  padding: '6px 14px',
                  fontSize: 12,
                  fontFamily: 'var(--font-ui)',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Loading state — 3 skeleton rows */}
          {driveLoading && (
            <div>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}

          {/* Error state */}
          {driveError && !driveLoading && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: 48, gap: 12,
            }}>
              <CloudOff size={32} color="var(--color-text-muted)" />
              <div style={{
                fontSize: 13, color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-ui)', textAlign: 'center',
              }}>
                Kunde inte ladda filer
              </div>
              <button
                onClick={retryLoad}
                style={{
                  background: 'var(--color-primary)', color: '#fff',
                  border: 'none', borderRadius: '999px',
                  padding: '10px 20px', fontSize: 13,
                  fontFamily: 'var(--font-ui)', cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                Försök igen
              </button>
            </div>
          )}

          {/* File list */}
          {!driveLoading && !driveError && (
            <div>
              {filteredFiles.length === 0 && (
                <div style={{
                  padding: '32px 0', textAlign: 'center',
                  color: 'var(--color-text-muted)', fontSize: 13,
                  fontFamily: 'var(--font-ui)',
                }}>
                  Inga filer i den här kategorin.
                </div>
              )}
              {filteredFiles.map(file => {
                const cat = getCategory(file);
                return (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: 12, padding: '12px 0',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    {/* Category icon */}
                    <div style={{ color: getCategoryColor(cat), flexShrink: 0 }}>
                      {getCategoryIcon(cat)}
                    </div>

                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 14,
                          color: 'var(--color-text)',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'block',
                          textDecoration: 'none',
                        }}
                      >
                        {file.name}
                      </a>
                    </div>

                    {/* Size + date */}
                    <div style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'flex-end', flexShrink: 0,
                      gap: 2,
                    }}>
                      {file.size && (
                        <span style={{
                          fontSize: 11,
                          color: 'var(--color-text-muted)',
                          fontFamily: 'var(--font-ui)',
                        }}>
                          {formatSize(file.size)}
                        </span>
                      )}
                      <span style={{
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        fontFamily: 'var(--font-ui)',
                      }}>
                        {formatModifiedDate(file.modifiedTime)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
