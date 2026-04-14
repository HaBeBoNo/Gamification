import React, { useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  HardDrive,
  Image,
  Mic2,
  Pin,
  RefreshCw,
  Upload,
  FileText,
} from 'lucide-react';
import { formatDate } from '@/lib/googleDrive';
import { supabase } from '@/lib/supabase';
import CalendarView from './CalendarView';
import GoogleConnectButton from './GoogleConnectButton';
import { BAND_HUB_TABS, DRIVE_FILTERS, formatRelativeDriveDate, type BandHubTabId } from '@/lib/bandHubSurface';
import { useDriveSurface } from '@/hooks/useDriveSurface';
import { consumeBandHubIntent, subscribeToBandHubIntent } from '@/lib/navigationIntent';
import { CalendarSpotlight } from '@/components/game/bandhub/CalendarSpotlight';
import { SectionEyebrow } from '@/components/game/bandhub/SectionEyebrow';
import { StatCard } from '@/components/game/bandhub/StatCard';
import { FileRow } from '@/components/game/bandhub/FileRow';
import { QuickOpenCard } from '@/components/game/bandhub/QuickOpenCard';
import { emptyCardStyle, iconButtonStyle, primaryButtonStyle } from '@/components/game/bandhub/styles';

export default function BandHub() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const initialIntent = useMemo(() => {
    return consumeBandHubIntent();
  }, []);
  const initialTab = useMemo<BandHubTabId>(() => {
    return initialIntent?.tab || 'kalender';
  }, [initialIntent]);
  const [activeTab, setActiveTab] = useState<BandHubTabId>(initialTab);
  const [currentIntent, setCurrentIntent] = useState(initialIntent);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTabMeta = BAND_HUB_TABS.find((tab) => tab.id === activeTab) || BAND_HUB_TABS[0];
  const {
    files,
    loading,
    error,
    uploading,
    uploadSuccess,
    driveFilter,
    setDriveFilter,
    pinMode,
    googleToken,
    setGoogleToken,
    loadDriveSurface,
    loadFiles,
    handleTogglePin,
    handleUpload,
    emptyDriveMessage,
    driveStats,
    featuredFiles,
    flowFiles,
    latestRecording,
    latestDocument,
    latestImage,
  } = useDriveSurface(activeTab === 'drive');

  React.useEffect(() => {
    return subscribeToBandHubIntent((incomingIntent) => {
      const nextIntent = consumeBandHubIntent() || incomingIntent;
      setCurrentIntent(nextIntent);
      setActiveTab(nextIntent.tab);
    });
  }, []);

  return (
    <div style={{ paddingBottom: '96px' }}>
      <div style={{ padding: '16px var(--layout-gutter-room) 12px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          borderRadius: '999px',
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-micro)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          <activeTabMeta.icon size={14} />
          {activeTabMeta.eyebrow}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.2rem, 4.8vw, 1.65rem)',
            lineHeight: 1.1,
            color: 'var(--color-text)',
            marginBottom: 6,
          }}>
            {activeTabMeta.title}
          </div>
          {activeTabMeta.desc ? (
            <div style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-muted)',
              lineHeight: 1.55,
              maxWidth: 560,
            }}>
              {activeTabMeta.desc}
            </div>
          ) : null}
        </div>

        <div style={{
          display: 'flex',
          gap: 8,
          padding: 4,
          borderRadius: '16px',
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border)',
        }}>
          {BAND_HUB_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setCurrentIntent(null);
                  setActiveTab(tab.id);
                }}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: active ? 'var(--color-primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-muted)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-ui)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  transition: 'all var(--duration-fast) var(--ease-out)',
                }}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'kalender' && (
        <div style={{ padding: 'var(--section-gap) var(--layout-gutter-room) 0' }}>
          <CalendarSpotlight />
          <section style={{ marginTop: 'var(--section-gap)' }}>
            <SectionEyebrow title="Allt i kalendern" />
          </section>
          <CalendarView
            focusedEventId={currentIntent?.tab === 'kalender' ? currentIntent.eventId : undefined}
            focusIntentTs={currentIntent?.ts}
          />
        </div>
      )}

      {activeTab === 'drive' && (
        <div style={{ padding: 'var(--section-gap) var(--layout-gutter-room) 0' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10,
            marginBottom: 'var(--section-gap)',
          }}>
            <StatCard icon={<HardDrive size={15} />} label="Filer" value={String(driveStats.total)} />
            <StatCard icon={<Pin size={15} />} label="Fästa" value={String(driveStats.pinned)} />
            <StatCard
              icon={<Clock3 size={15} />}
              label="Senast"
              value={driveStats.latestModified ? formatDate(driveStats.latestModified) : '—'}
              detail={driveStats.latestModified ? formatRelativeDriveDate(driveStats.latestModified) : undefined}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              Sektionen Drive
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => void loadDriveSurface()} style={iconButtonStyle} aria-label="Ladda om filer">
                <RefreshCw size={16} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ ...primaryButtonStyle, opacity: uploading ? 0.7 : 1 }}
              >
                <Upload size={14} />
                {uploading ? 'Laddar upp...' : 'Ladda upp'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={(event) => {
                  void handleUpload(event.target.files?.[0] || null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
            </div>
          </div>

          {googleClientId && (
            <div style={{
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: '16px',
              padding: '12px 14px',
              marginBottom: 'var(--section-gap)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-micro)',
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  Google
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 30,
                  padding: '0 10px',
                  borderRadius: '999px',
                  background: googleToken ? 'var(--color-primary-muted)' : 'var(--color-surface)',
                  border: `1px solid ${googleToken ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  color: googleToken ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontSize: 'var(--text-micro)',
                  fontFamily: 'var(--font-ui)',
                  letterSpacing: '0.04em',
                }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: googleToken ? 'currentColor' : 'var(--color-text-subtle)',
                    opacity: googleToken ? 1 : 0.75,
                  }} />
                  {googleToken ? 'Uppladdning på' : 'Anslut uppladdning'}
                </div>
              </div>
              <GoogleConnectButton
                tokenData={googleToken}
                onConnect={(token) => {
                  setGoogleToken(token);
                }}
                onDisconnect={() => {
                  setGoogleToken(null);
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 'var(--section-gap)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              paddingRight: 6,
              fontSize: 'var(--text-micro)',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
            }}>
              {pinMode === 'shared' ? 'Fästa delas i bandet' : 'Fästa sparas lokalt'}
            </div>
            {DRIVE_FILTERS.map((filter) => {
              const active = driveFilter === filter.id;
              const count = filter.id === 'alla'
                ? driveStats.total
                : filter.id === 'fasta'
                  ? driveStats.pinned
                  : driveStats.categoryCounts[filter.id] || 0;
              return (
                <button
                  key={filter.id}
                  onClick={() => setDriveFilter(filter.id)}
                  style={{
                    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: active ? 'var(--color-primary-muted)' : 'var(--color-surface-elevated)',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    borderRadius: '999px',
                    minHeight: '36px',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-ui)',
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                >
                  {filter.label} {count > 0 ? `· ${count}` : ''}
                </button>
              );
            })}
          </div>

          {uploadSuccess && (
            <div style={{
              background: 'var(--color-accent)20',
              border: '1px solid var(--color-accent)40',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              fontSize: 'var(--text-caption)',
              color: 'var(--color-accent)',
              marginBottom: 'var(--section-gap)',
            }}>
              ✓ {uploadSuccess}
            </div>
          )}

          {loading && <div style={emptyCardStyle}>Hämtar filer...</div>}

          {error && !loading && (
            <div style={{ ...emptyCardStyle, textAlign: 'center' }}>
              <div style={{ marginBottom: 14 }}>{error}</div>
              <button onClick={() => void loadFiles()} style={primaryButtonStyle}>
                Försök igen
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {driveFilter === 'alla' && (latestRecording || latestDocument || latestImage) && (
                <section style={{ marginBottom: 'var(--section-gap)' }}>
                  <SectionEyebrow title="Öppna först" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                    {latestRecording ? <QuickOpenCard icon={<Mic2 size={15} />} eyebrow="Senaste inspelning" file={latestRecording} /> : null}
                    {latestDocument ? <QuickOpenCard icon={<FileText size={15} />} eyebrow="Senaste dokument" file={latestDocument} /> : null}
                    {latestImage ? <QuickOpenCard icon={<Image size={15} />} eyebrow="Senaste bild" file={latestImage} /> : null}
                  </div>
                </section>
              )}

              {featuredFiles.length > 0 && (
                <section style={{ marginBottom: 'var(--section-gap)' }}>
                  <SectionEyebrow title="Fästa filer" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {featuredFiles.map((file) => (
                      <FileRow key={file.id} file={file} pinned={true} onTogglePin={() => handleTogglePin(file.id)} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <SectionEyebrow
                  title={driveFilter === 'alla' ? 'Senast' : DRIVE_FILTERS.find((filter) => filter.id === driveFilter)?.label ?? 'Filer'}
                />

                {flowFiles.length === 0 && featuredFiles.length === 0 && files.length === 0 && (
                  <div style={{ ...emptyCardStyle, textAlign: 'center' }}>
                    <div style={{ marginBottom: 14 }}>Tomt i Drive just nu.</div>
                    <button
                      onClick={async () => {
                        if (supabase) await supabase.auth.signOut();
                        localStorage.removeItem('sektionen_google_token');
                        window.location.reload();
                      }}
                      style={primaryButtonStyle}
                    >
                      Logga in igen
                    </button>
                  </div>
                )}

                {flowFiles.length === 0 && (featuredFiles.length > 0 || files.length > 0) && (
                  <div style={emptyCardStyle}>{emptyDriveMessage}</div>
                )}

                {flowFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {flowFiles.map((file) => (
                      <FileRow key={file.id} file={file} pinned={false} onTogglePin={() => handleTogglePin(file.id)} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
