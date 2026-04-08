import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  ExternalLink,
  Folder,
  FileText,
  Music,
  Video,
  Image,
  File,
  RefreshCw,
  CalendarDays,
  HardDrive,
  Pin,
  Clock3,
  Mic2,
} from 'lucide-react';
import { fetchPinnedFileIds, getCategory, getDriveFiles, uploadFile, getMimeTypeLabel, formatDate, subscribePinnedFiles, togglePinnedFile, type DriveFile } from '@/lib/googleDrive';
import { supabase } from '@/lib/supabase';
import { S } from '@/state/store';
import CalendarView from './CalendarView';
import { getUpcomingEvents, isEventActive, isEventSoon } from '@/lib/googleCalendar';
import { isCalendarResponseNeeded } from '@/lib/reengagement';

const TABS = [
  {
    id: 'kalender',
    label: 'Kalender',
    eyebrow: 'Bandets rytm',
    title: 'Det som händer nu och snart',
    desc: 'Håll koll på rep, aktiviteter och det som förtjänar närvaro.',
    icon: CalendarDays,
  },
  {
    id: 'drive',
    label: 'Drive',
    eyebrow: 'Bandets material',
    title: 'Filerna ni faktiskt använder',
    desc: 'Snabb väg till senaste materialet, viktiga dokument och det som ska upp igen.',
    icon: HardDrive,
  },
] as const;

const DRIVE_FILTERS = [
  { id: 'alla', label: 'Alla' },
  { id: 'fasta', label: 'Fästa' },
  { id: 'inspelningar', label: 'Inspelningar' },
  { id: 'dokument', label: 'Dokument' },
  { id: 'bilder', label: 'Bilder' },
  { id: 'ovrigt', label: 'Övrigt' },
] as const;

type BandHubTabId = (typeof TABS)[number]['id'];
type DriveFilterId = (typeof DRIVE_FILTERS)[number]['id'];

function getMimeIcon(mimeType: string) {
  if (mimeType.includes('folder')) return <Folder size={16} />;
  if (mimeType.includes('document')) return <FileText size={16} />;
  if (mimeType.includes('audio')) return <Music size={16} />;
  if (mimeType.includes('video')) return <Video size={16} />;
  if (mimeType.includes('image')) return <Image size={16} />;
  return <File size={16} />;
}

function formatRelativeDriveDate(dateStr?: string): string {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Uppdaterad nyligen';
  if (diffHours < 24) return `Uppdaterad ${diffHours}h sedan`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays <= 7) return `Uppdaterad ${diffDays}d sedan`;
  return `Uppdaterad ${formatDate(dateStr)}`;
}

function formatFileSize(size?: string): string {
  const value = Number(size || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  const rounded = current >= 10 || unitIndex === 0 ? Math.round(current) : Math.round(current * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
}

export default function BandHub() {
  const [activeTab, setActiveTab] = useState<BandHubTabId>('kalender');
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [driveFilter, setDriveFilter] = useState<DriveFilterId>('alla');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [pinMode, setPinMode] = useState<'shared' | 'local'>('local');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTabMeta = TABS.find((tab) => tab.id === activeTab) || TABS[0];

  useEffect(() => {
    if (activeTab === 'drive') {
      void loadDriveSurface();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'drive') return;
    const channel = subscribePinnedFiles(() => {
      void loadPins();
    });
    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [activeTab]);

  async function loadFiles() {
    setLoading(true);
    setError('');
    try {
      const result = await getDriveFiles();
      setFiles(result);
    } catch {
      setError('Kunde inte hämta filer just nu.');
    } finally {
      setLoading(false);
    }
  }

  async function loadPins() {
    try {
      const result = await fetchPinnedFileIds();
      setPinnedIds(result.ids);
      setPinMode(result.source);
    } catch (err: any) {
      console.warn('[BandHub] pin load failed:', err?.message || err);
    }
  }

  async function loadDriveSurface() {
    await Promise.all([loadFiles(), loadPins()]);
  }

  async function handleTogglePin(id: string) {
    const previous = pinnedIds;
    const wasPinned = previous.includes(id);
    const optimistic = wasPinned
      ? previous.filter((p) => p !== id)
      : [...previous, id];
    setPinnedIds(optimistic);

    try {
      const source = await togglePinnedFile(id, wasPinned, S.me);
      setPinMode(source);
    } catch (err: any) {
      setPinnedIds(previous);
      setError(typeof err?.message === 'string' && err.message ? err.message : 'Kunde inte uppdatera fästning.');
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadSuccess('');
    setError('');
    try {
      await uploadFile(file);
      setUploadSuccess(`${file.name} uppladdad!`);
      await loadDriveSurface();
    } catch (err: any) {
      const message = typeof err?.message === 'string' && err.message
        ? err.message
        : 'Uppladdning misslyckades.';
      setError(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const pinnedFiles = useMemo(
    () => files.filter((file) => pinnedIds.includes(file.id)),
    [files, pinnedIds]
  );

  const driveStats = useMemo(() => {
    const byCategory = files.reduce<Record<string, number>>((acc, file) => {
      const category = getCategory(file);
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    return {
      total: files.length,
      pinned: pinnedFiles.length,
      categoryCounts: byCategory,
      latestModified: files[0]?.modifiedTime || null,
    };
  }, [files, pinnedFiles.length]);

  const filteredFiles = useMemo(() => {
    if (driveFilter === 'alla') return files;
    if (driveFilter === 'fasta') return pinnedFiles;
    return files.filter((file) => getCategory(file) === driveFilter);
  }, [driveFilter, files, pinnedFiles]);

  const featuredFiles = useMemo(
    () => filteredFiles.filter((file) => pinnedIds.includes(file.id)),
    [filteredFiles, pinnedIds]
  );

  const flowFiles = useMemo(
    () => filteredFiles.filter((file) => !pinnedIds.includes(file.id)),
    [filteredFiles, pinnedIds]
  );

  const latestRecording = useMemo(
    () => files.find((file) => getCategory(file) === 'inspelningar') || null,
    [files]
  );

  const latestDocument = useMemo(
    () => files.find((file) => getCategory(file) === 'dokument') || null,
    [files]
  );

  const latestImage = useMemo(
    () => files.find((file) => getCategory(file) === 'bilder') || null,
    [files]
  );

  const emptyDriveMessage = driveFilter === 'fasta'
    ? 'Inga filer är fästa ännu.'
    : driveFilter === 'alla'
      ? 'Inga filer hittades i Sektionen-mappen.'
      : `Inga filer hittades i kategorin ${DRIVE_FILTERS.find((filter) => filter.id === driveFilter)?.label?.toLowerCase()}.`;

  return (
    <div style={{ paddingBottom: '96px' }}>
      <div
        style={{
          padding: '16px var(--layout-gutter-room) 12px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
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
          }}
        >
          <activeTabMeta.icon size={14} />
          {activeTabMeta.eyebrow}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.2rem, 4.8vw, 1.65rem)',
              lineHeight: 1.1,
              color: 'var(--color-text)',
              marginBottom: 6,
            }}
          >
            {activeTabMeta.title}
          </div>
          <div
            style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-muted)',
              lineHeight: 1.55,
              maxWidth: 560,
            }}
          >
            {activeTabMeta.desc}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: 4,
            borderRadius: '16px',
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
          }}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
            <SectionEyebrow
              title="Allt i kalendern"
              subtitle="Rep, svar och check-ins på ett ställe"
            />
          </section>
          <CalendarView />
        </div>
      )}

      {activeTab === 'drive' && (
        <div style={{ padding: 'var(--section-gap) var(--layout-gutter-room) 0' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10,
              marginBottom: 'var(--section-gap)',
            }}
          >
            <StatCard
              icon={<HardDrive size={15} />}
              label="Filer"
              value={String(driveStats.total)}
              detail="i hubben"
            />
            <StatCard
              icon={<Pin size={15} />}
              label="Fästa"
              value={String(driveStats.pinned)}
              detail="snabb access"
            />
            <StatCard
              icon={<Clock3 size={15} />}
              label="Senast"
              value={driveStats.latestModified ? formatDate(driveStats.latestModified) : '—'}
              detail={driveStats.latestModified ? formatRelativeDriveDate(driveStats.latestModified) : 'ingen aktivitet'}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Sektionen Drive
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => void loadDriveSurface()}
                style={iconButtonStyle}
                aria-label="Ladda om filer"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  ...primaryButtonStyle,
                  opacity: uploading ? 0.7 : 1,
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

          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 4,
              marginBottom: 'var(--section-gap)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                paddingRight: 6,
                fontSize: 'var(--text-micro)',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}
            >
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
            <div
              style={{
                background: 'var(--color-accent)20',
                border: '1px solid var(--color-accent)40',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                fontSize: 'var(--text-caption)',
                color: 'var(--color-accent)',
                marginBottom: 'var(--section-gap)',
              }}
            >
              ✓ {uploadSuccess}
            </div>
          )}

          {loading && (
            <div style={emptyCardStyle}>
              Hämtar filer...
            </div>
          )}

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
                  <SectionEyebrow
                    title="Öppna först"
                    subtitle="Det som oftast är mest relevant när någon går in här"
                  />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: 10,
                    }}
                  >
                    {latestRecording ? (
                      <QuickOpenCard
                        icon={<Mic2 size={15} />}
                        eyebrow="Senaste inspelning"
                        file={latestRecording}
                      />
                    ) : null}
                    {latestDocument ? (
                      <QuickOpenCard
                        icon={<FileText size={15} />}
                        eyebrow="Senaste dokument"
                        file={latestDocument}
                      />
                    ) : null}
                    {latestImage ? (
                      <QuickOpenCard
                        icon={<Image size={15} />}
                        eyebrow="Senaste bild"
                        file={latestImage}
                      />
                    ) : null}
                  </div>
                </section>
              )}

              {featuredFiles.length > 0 && (
                <section style={{ marginBottom: 'var(--section-gap)' }}>
                  <SectionEyebrow title="Fästa filer" subtitle="Det som ska vara nära till hands" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {featuredFiles.map((file) => (
                      <FileRow
                        key={file.id}
                        file={file}
                        pinned={true}
                        onTogglePin={() => handleTogglePin(file.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <SectionEyebrow
                  title={driveFilter === 'alla' ? 'Flödet just nu' : `Visar ${DRIVE_FILTERS.find((filter) => filter.id === driveFilter)?.label.toLowerCase()}`}
                  subtitle="Det senaste som är relevant att öppna"
                />

                {flowFiles.length === 0 && featuredFiles.length === 0 && files.length === 0 && (
                  <div style={{ ...emptyCardStyle, textAlign: 'center' }}>
                    <div style={{ marginBottom: 14 }}>
                      Inga filer hittades i den här Drive-mappen ännu.
                    </div>
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
                  <div style={emptyCardStyle}>
                    {emptyDriveMessage}
                  </div>
                )}

                {flowFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {flowFiles.map((file) => (
                      <FileRow
                        key={file.id}
                        file={file}
                        pinned={false}
                        onTogglePin={() => handleTogglePin(file.id)}
                      />
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

function CalendarSpotlight() {
  const [events, setEvents] = useState<Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      try {
        const upcoming = await getUpcomingEvents(3);
        if (!cancelled) setEvents(upcoming);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  const nextEvent = events[0] || null;
  const hasRsvp = nextEvent ? (S.checkIns ?? []).some((entry: any) => entry?.eventId === nextEvent.id && entry?.type === 'rsvp' && entry?.memberKey === S.me) : false;
  const rsvpCount = nextEvent ? (S.checkIns ?? []).filter((entry: any) => entry?.eventId === nextEvent.id && entry?.type === 'rsvp').length : 0;
  const checkInCount = nextEvent ? (S.checkIns ?? []).filter((entry: any) => entry?.eventId === nextEvent.id && entry?.type !== 'rsvp').length : 0;
  const active = nextEvent ? isEventActive(nextEvent.start, nextEvent.end) : false;
  const soon = nextEvent ? isEventSoon(nextEvent.start) : false;
  const needsResponse = nextEvent ? isCalendarResponseNeeded(nextEvent.start, hasRsvp) : false;
  const nextLabel = nextEvent
    ? new Date(nextEvent.start).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
    : '—';
  const nextTime = nextEvent
    ? new Date(nextEvent.start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <section style={{ marginBottom: 'var(--section-gap)' }}>
      <SectionEyebrow
        title="Det som kräver respons nu"
        subtitle="Kalendern ska vara den snabbaste vägen till bandets rytm"
      />

      {loading ? (
        <div style={emptyCardStyle}>
          Läser in nästa bandpunkt...
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <StatCard
              icon={<CalendarDays size={15} />}
              label="Nästa"
              value={nextLabel}
              detail={nextEvent ? `${nextEvent.title} · ${nextTime}` : 'ingen händelse planerad'}
            />
            <StatCard
              icon={<Clock3 size={15} />}
              label="Kommer"
              value={nextEvent ? String(rsvpCount) : '0'}
              detail={nextEvent ? (hasRsvp ? 'du är med' : 'svara i listan nedan') : 'ingen respons behövs'}
            />
            <StatCard
              icon={<Mic2 size={15} />}
              label="Live"
              value={nextEvent ? String(checkInCount) : '0'}
              detail={active ? 'incheckade just nu' : soon ? 'redo för check-in' : 'ingen aktivitet just nu'}
            />
          </div>

          <div
            style={{
              background: active || needsResponse
                ? 'color-mix(in srgb, var(--color-primary-muted) 42%, var(--color-surface-elevated))'
                : 'var(--color-surface-elevated)',
              border: `1px solid ${active || needsResponse ? 'color-mix(in srgb, var(--color-primary) 35%, var(--color-border))' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-card)',
              padding: '16px 16px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                color: active || needsResponse ? 'var(--color-primary)' : 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              {active ? 'Live nu' : needsResponse ? 'Behöver ditt svar' : nextEvent ? 'Nästa bandpunkt' : 'Lugnare läge'}
            </div>
            <div
              style={{
                fontSize: 'var(--text-body)',
                color: 'var(--color-text)',
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              {active
                ? `${nextEvent?.title} är igång`
                : needsResponse
                  ? `Svara på ${nextEvent?.title} medan det fortfarande är nära`
                  : nextEvent
                    ? `${nextEvent.title} håller bandets rytm uppe`
                    : 'Kalendern är lugn just nu'}
            </div>
            <div
              style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                lineHeight: 1.55,
              }}
            >
              {active
                ? `${checkInCount} incheckad${checkInCount === 1 ? '' : 'e'} hittills. Om du är på plats, checka in i listan nedan så att närvaron blir synlig.`
                : needsResponse
                  ? `${rsvpCount} har redan svarat. Det här är en av de starkaste sociala signalerna i appen, så den ska kännas enkel att ta hand om direkt här.`
                  : nextEvent
                    ? hasRsvp
                      ? 'Du är redan med. Håll koll här när det närmar sig live-läge och check-in börjar spela roll.'
                      : 'Du behöver inte göra något direkt nu, men det här är nästa naturliga punkt där bandet samlas igen.'
                    : 'När nästa rep, planering eller aktivitet landar i kalendern ska den här ytan bli den snabbaste vägen tillbaka in i bandets vardag.'}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SectionEyebrow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-micro)',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-muted)',
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function StatCard({
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
    <div
      style={{
        background: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: '14px 12px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--color-text-muted)',
          marginBottom: 10,
        }}
      >
        {icon}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-micro)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 'var(--text-body)',
          color: 'var(--color-text)',
          fontWeight: 600,
          marginBottom: 4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 'var(--text-micro)',
          color: 'var(--color-text-muted)',
          lineHeight: 1.4,
        }}
      >
        {detail}
      </div>
    </div>
  );
}

function FileRow({
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
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 14px',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        background: pinned ? 'color-mix(in srgb, var(--color-primary-muted) 50%, var(--color-surface-elevated))' : 'var(--color-surface-elevated)',
      }}
    >
      <div
        style={{
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
        }}
      >
        {getMimeIcon(file.mimeType)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-micro)',
              color: pinned ? 'var(--color-primary)' : 'var(--color-text-muted)',
              background: pinned ? 'var(--color-primary-muted)' : 'var(--color-surface)',
              border: `1px solid ${pinned ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: '999px',
              padding: '2px 8px',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {pinned ? 'Fäst' : categoryLabel}
          </span>
          <span
            style={{
              fontSize: 'var(--text-micro)',
              color: 'var(--color-text-muted)',
            }}
          >
            {getMimeTypeLabel(file.mimeType)}
            {formatFileSize(file.size) ? ` · ${formatFileSize(file.size)}` : ''}
          </span>
        </div>

        <div
          style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-text)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 4,
          }}
        >
          {file.name}
        </div>

        <div
          style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-muted)',
            lineHeight: 1.45,
          }}
        >
          {formatRelativeDriveDate(file.modifiedTime)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onTogglePin}
          style={iconButtonStyle}
          title={pinned ? 'Ta bort fästning' : 'Fäst fil'}
          aria-label={pinned ? 'Ta bort fästning' : 'Fäst fil'}
        >
          <Pin size={14} fill={pinned ? 'currentColor' : 'none'} />
        </button>
        <a
          href={file.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...iconButtonStyle,
            textDecoration: 'none',
          }}
          aria-label={`Öppna ${file.name}`}
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

function QuickOpenCard({
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--color-text-muted)',
      }}>
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
      <div style={{
        fontSize: 'var(--text-micro)',
        color: 'var(--color-text-muted)',
      }}>
        {formatRelativeDriveDate(file.modifiedTime)}
      </div>
    </a>
  );
}

const primaryButtonStyle: React.CSSProperties = {
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

const iconButtonStyle: React.CSSProperties = {
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

const emptyCardStyle: React.CSSProperties = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-card)',
  padding: '24px 18px',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-caption)',
  lineHeight: 1.55,
};
