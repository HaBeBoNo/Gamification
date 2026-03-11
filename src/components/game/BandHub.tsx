/**
 * BandHub.tsx
 * Google Workspace integration hub: Drive, Calendar, Docs, Sheets.
 * Wraps the inner component with GoogleOAuthProvider.
 * Fetches live data from Google APIs; falls back to placeholder data on error.
 */

import React, { useState, useEffect, useCallback, Component } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import {
  FolderOpen, Calendar, FileText, Table2, Upload,
  Search, Music, Image, MoreHorizontal, ChevronLeft,
  ChevronRight, Plus, FilePlus, BarChart2, List, X, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import {
  isAuthenticated, loadToken, GoogleTokenData,
} from '../../lib/googleAuth';
import {
  listFiles, uploadFile, getFileUrl, formatFileSize, formatDriveDate,
  mimeToCategory, DriveFile,
} from '../../lib/googleDrive';
import {
  getUpcomingEvents, createEvent, formatEventDate, formatEventTime,
  CalendarEvent,
} from '../../lib/googleCalendar';
import {
  listDocs, createDoc, getDocUrl, getDocAuthor, GoogleDoc,
} from '../../lib/googleDocs';
import {
  listSheets, getSheetUrl, getSheetAuthor, GoogleSheet,
} from '../../lib/googleSheets';
import GoogleConnectButton from './GoogleConnectButton';

/* ── Error boundary to prevent OAuth errors from crashing parent app ── */
class BandHubErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>
          <div style={{ marginBottom: 'var(--space-sm)', fontSize: 'var(--text-body)', color: 'var(--color-warning)' }}>
            Band Hub kunde inte laddas
          </div>
          <div>{this.state.error}</div>
          <div style={{ marginTop: 'var(--space-sm)' }}>Kontrollera att VITE_GOOGLE_CLIENT_ID är satt i .env.local</div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Env ── */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

/* ── Tabs ── */
const TABS = [
  { id: 'drive',    label: 'Drive',    icon: FolderOpen },
  { id: 'kalender', label: 'Kalender', icon: Calendar },
  { id: 'dokument', label: 'Dokument', icon: FileText },
  { id: 'sheets',   label: 'Sheets',   icon: Table2 },
];

/* ── Fallback placeholder data (shown when not authenticated or on API error) ── */
const FALLBACK_FILES = [
  { id: 'p1', name: 'Arms_demo_v3.wav',          mimeType: 'audio/wav',  size: '4404019', modifiedTime: new Date().toISOString() },
  { id: 'p2', name: 'Praise_You_stems.zip',       mimeType: 'application/zip', size: '18874368', modifiedTime: new Date(Date.now()-86400000).toISOString() },
  { id: 'p3', name: 'Ölslanda_konsert.jpg',       mimeType: 'image/jpeg', size: '3250586', modifiedTime: new Date(Date.now()-7*86400000).toISOString() },
  { id: 'p4', name: 'Bidragsansökan_VGR.docx',    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: '245760', modifiedTime: new Date(Date.now()-3*86400000).toISOString() },
  { id: 'p5', name: 'Ignited_rough_mix.mp3',      mimeType: 'audio/mpeg', size: '9123456', modifiedTime: new Date(Date.now()-4*86400000).toISOString() },
  { id: 'p6', name: 'Budget_2026.xlsx',           mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: '159744', modifiedTime: new Date(Date.now()-5*86400000).toISOString() },
] as DriveFile[];

const FALLBACK_EVENTS: CalendarEvent[] = [
  { id: 'e1', summary: 'Rep Lerum 18:00',         start: { dateTime: '2026-03-09T18:00:00+01:00' }, end: { dateTime: '2026-03-09T21:00:00+01:00' } },
  { id: 'e2', summary: 'Styrelsemöte 14:00',      start: { dateTime: '2026-03-15T14:00:00+01:00' }, end: { dateTime: '2026-03-15T16:00:00+01:00' } },
  { id: 'e3', summary: 'Studiosession Martin',    start: { date: '2026-03-22' }, end: { date: '2026-03-22' } },
  { id: 'e4', summary: 'Spelning Göteborg TBC',   start: { date: '2026-03-29' }, end: { date: '2026-03-29' } },
  { id: 'e5', summary: 'Truminspelning (block)',  start: { date: '2026-04-05' }, end: { date: '2026-04-05' } },
];

const FALLBACK_DOCS: GoogleDoc[] = [
  { id: 'd1', name: 'Sektionen — Stadgar 2024',         lastModifyingUser: { displayName: 'Ludvig' },    modifiedTime: '2026-01-15' },
  { id: 'd2', name: 'Turné-rider Q2 2026',              lastModifyingUser: { displayName: 'Johannes' },  modifiedTime: '2026-03-03' },
  { id: 'd3', name: 'Presskit — Album II',              lastModifyingUser: { displayName: 'Hannes' },    modifiedTime: '2026-02-28' },
  { id: 'd4', name: 'Bidragsansökan Västra Götaland',   lastModifyingUser: { displayName: 'Carl' },      modifiedTime: '2026-03-06' },
  { id: 'd5', name: 'EP-produktionsplan',               lastModifyingUser: { displayName: 'Martin' },    modifiedTime: '2026-03-02' },
];

const FALLBACK_SHEETS: GoogleSheet[] = [
  { id: 's1', name: 'Budget 2026',          lastModifyingUser: { displayName: 'Simon' },    modifiedTime: '2026-03-04' },
  { id: 's2', name: 'Metrics & Streams',    lastModifyingUser: { displayName: 'Hannes' },   modifiedTime: new Date().toISOString() },
  { id: 's3', name: 'Setlista — Spelningar 2026', lastModifyingUser: { displayName: 'Johannes' }, modifiedTime: '2026-02-28' },
];

/* ── Helpers ── */
const FILE_ICON_MAP: Record<string, { icon: typeof Music; color: string }> = {
  Music:    { icon: Music,    color: 'var(--color-accent)' },
  Image:    { icon: Image,    color: 'var(--color-primary)' },
  FileText: { icon: FileText, color: 'var(--color-text-secondary)' },
  Table:    { icon: Table2,   color: 'var(--color-accent)' },
};

function fileIconProps(file: DriveFile) {
  return FILE_ICON_MAP[mimeToCategory(file.mimeType)] ?? FILE_ICON_MAP.FileText;
}

function sheetIcon(sheet: GoogleSheet) {
  if (sheet.name.toLowerCase().includes('budget') || sheet.name.toLowerCase().includes('metrics'))
    return { Icon: BarChart2, color: 'var(--color-primary)' };
  return { Icon: List, color: 'var(--color-text-secondary)' };
}

/* ── Google G logo ── */
function GoogleLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.998 23.998 0 000 24c0 3.77.9 7.35 2.56 10.56l7.97-5.97z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.97C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

/* ── Bottom sheet ── */
function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="overflow-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="overflow-sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          >
            <div className="overflow-handle" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Calendar helper ── */
function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const days: { day: number; current: boolean }[] = [];
  for (let i = offset - 1; i >= 0; i--) days.push({ day: daysInPrev - i, current: false });
  for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, current: true });
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) days.push({ day: i, current: false });
  return days;
}

/* ── Spinner ── */
function Spinner() {
  return <Loader2 size={20} style={{ color: 'var(--color-text-muted)', animation: 'spin 1s linear infinite' }} />;
}

/* ══════════════════════════════════════════════════════════
   Inner BandHub component (must be inside GoogleOAuthProvider)
══════════════════════════════════════════════════════════ */
function BandHubInner() {
  const [tab, setTab] = useState('drive');
  const [showBanner, setShowBanner] = useState(true);

  // Auth state
  const [tokenData, setTokenData] = useState<GoogleTokenData | null>(
    isAuthenticated() ? loadToken() : null
  );
  const authed = !!tokenData;

  // Data state
  const [files,   setFiles]   = useState<DriveFile[]>(FALLBACK_FILES);
  const [events,  setEvents]  = useState<CalendarEvent[]>(FALLBACK_EVENTS);
  const [docs,    setDocs]    = useState<GoogleDoc[]>(FALLBACK_DOCS);
  const [sheets,  setSheets]  = useState<GoogleSheet[]>(FALLBACK_SHEETS);

  // Loading / error state per tab
  const [loading,     setLoading]     = useState<Record<string, boolean>>({});
  const [tabError,    setTabError]    = useState<Record<string, string | null>>({});

  // UI state
  const [selectedFile,  setSelectedFile]  = useState<DriveFile | null>(null);
  const [selectedDoc,   setSelectedDoc]   = useState<GoogleDoc | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheet | null>(null);
  const [showNewDoc,    setShowNewDoc]     = useState(false);
  const [newDocTitle,   setNewDocTitle]   = useState('');
  const [uploadActive,  setUploadActive]  = useState(false);
  const [calMonth,      setCalMonth]       = useState({ year: 2026, month: 2 }); // 0-indexed month

  const setTabLoading = (t: string, v: boolean) =>
    setLoading(p => ({ ...p, [t]: v }));
  const setTabErr = (t: string, v: string | null) =>
    setTabError(p => ({ ...p, [t]: v }));

  // ── Fetch functions ──

  const fetchDrive = useCallback(async () => {
    setTabLoading('drive', true);
    setTabErr('drive', null);
    try {
      const data = await listFiles();
      setFiles(data.length > 0 ? data : FALLBACK_FILES);
    } catch (e) {
      setTabErr('drive', 'Kunde inte hämta Drive-filer. Visar exempeldata.');
      setFiles(FALLBACK_FILES);
    } finally {
      setTabLoading('drive', false);
    }
  }, []);

  const fetchCalendar = useCallback(async () => {
    setTabLoading('kalender', true);
    setTabErr('kalender', null);
    try {
      const data = await getUpcomingEvents();
      setEvents(data.length > 0 ? data : FALLBACK_EVENTS);
    } catch (e) {
      setTabErr('kalender', 'Kunde inte hämta kalenderhändelser. Visar exempeldata.');
      setEvents(FALLBACK_EVENTS);
    } finally {
      setTabLoading('kalender', false);
    }
  }, []);

  const fetchDocs = useCallback(async () => {
    setTabLoading('dokument', true);
    setTabErr('dokument', null);
    try {
      const data = await listDocs();
      setDocs(data.length > 0 ? data : FALLBACK_DOCS);
    } catch (e) {
      setTabErr('dokument', 'Kunde inte hämta dokument. Visar exempeldata.');
      setDocs(FALLBACK_DOCS);
    } finally {
      setTabLoading('dokument', false);
    }
  }, []);

  const fetchSheets = useCallback(async () => {
    setTabLoading('sheets', true);
    setTabErr('sheets', null);
    try {
      const data = await listSheets();
      setSheets(data.length > 0 ? data : FALLBACK_SHEETS);
    } catch (e) {
      setTabErr('sheets', 'Kunde inte hämta kalkylark. Visar exempeldata.');
      setSheets(FALLBACK_SHEETS);
    } finally {
      setTabLoading('sheets', false);
    }
  }, []);

  // Fetch all data when authenticated
  useEffect(() => {
    if (!authed) return;
    fetchDrive();
    fetchCalendar();
    fetchDocs();
    fetchSheets();
  }, [authed, fetchDrive, fetchCalendar, fetchDocs, fetchSheets]);

  // Refetch current tab when switching (if authenticated)
  useEffect(() => {
    if (!authed) return;
    if (tab === 'drive')    fetchDrive();
    if (tab === 'kalender') fetchCalendar();
    if (tab === 'dokument') fetchDocs();
    if (tab === 'sheets')   fetchSheets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleConnect = (data: GoogleTokenData) => {
    setTokenData(data);
    setShowBanner(false);
  };

  const handleDisconnect = () => {
    setTokenData(null);
    setFiles(FALLBACK_FILES);
    setEvents(FALLBACK_EVENTS);
    setDocs(FALLBACK_DOCS);
    setSheets(FALLBACK_SHEETS);
  };

  // ── File upload handler ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !authed) return;
    try {
      const uploaded = await uploadFile(file);
      setFiles(prev => [uploaded, ...prev]);
    } catch {
      // Fail silently — file simply won't appear in list
    }
  };

  // ── Create doc handler ──
  const handleCreateDoc = async () => {
    if (!newDocTitle.trim() || !authed) return;
    try {
      const doc = await createDoc(newDocTitle.trim(), 'blank');
      setDocs(prev => [doc, ...prev]);
      setShowNewDoc(false);
      setNewDocTitle('');
      window.open(getDocUrl(doc.id), '_blank');
    } catch {
      setTabErr('dokument', 'Kunde inte skapa dokument.');
    }
  };

  // ── Create calendar event ──
  const handleCreateEvent = async () => {
    if (!authed) return;
    const title = prompt('Evenemangsnamn:');
    if (!title) return;
    const date = prompt('Datum (YYYY-MM-DD):');
    if (!date) return;
    try {
      const ev = await createEvent({ title, date, allDay: true });
      setEvents(prev => [ev, ...prev]);
    } catch {
      setTabErr('kalender', 'Kunde inte skapa händelse.');
    }
  };

  // ── Month navigation ──
  const prevMonth = () =>
    setCalMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  const nextMonth = () =>
    setCalMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );

  const MONTH_NAMES_SV = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
  ];

  // Build calendar event dot map for current month
  const eventDotMap: Record<number, string> = {};
  events.forEach(ev => {
    const raw = ev.start.dateTime ?? ev.start.date;
    if (!raw) return;
    const d = new Date(raw);
    if (d.getFullYear() === calMonth.year && d.getMonth() === calMonth.month) {
      eventDotMap[d.getDate()] = 'var(--color-accent)';
    }
  });

  const today = new Date();

  return (
    <div className="bh-root">

      {/* ── Top row: connect button ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-sm)' }}>
        <GoogleConnectButton
          tokenData={tokenData}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      </div>

      {/* ── Connect banner (shown until user connects or dismisses) ── */}
      {showBanner && !authed && (
        <div className="bh-banner">
          <button className="bh-banner-close" onClick={() => setShowBanner(false)}><X size={14} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <GoogleLogo size={32} />
            <div>
              <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                Koppla Google Workspace
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                Anslut för att se bandets riktiga filer, kalender och dokument
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bh-tabs">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`qf-pill ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={14} style={{ marginRight: 4, verticalAlign: '-2px' }} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══ DRIVE ═══ */}
      {tab === 'drive' && (
        <div className="bh-section">
          <div className="bh-header-row">
            <span style={{ fontSize: 'var(--text-heading)', fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
              Sektionen
            </span>
            <label className="bh-action-btn" style={{ cursor: 'pointer' }}>
              <Upload size={14} /> Ladda upp
              <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={!authed} />
            </label>
          </div>
          <div className="bh-search">
            <Search size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input type="text" placeholder="Sök i bandmappen..." />
          </div>

          {tabError.drive && (
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-warning)', padding: 'var(--space-sm) 0' }}>
              {tabError.drive}
            </div>
          )}

          {loading.drive ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xl)' }}>
              <Spinner />
            </div>
          ) : (
            <>
              <div className="bh-section-label">SENASTE FILER</div>
              <div className="bh-file-list">
                {files.slice(0, 10).map((f) => {
                  const { icon: Icon, color } = fileIconProps(f);
                  return (
                    <button key={f.id} className="bh-file-row" onClick={() => setSelectedFile(f)}>
                      <Icon size={16} style={{ color, flexShrink: 0 }} />
                      <span className="bh-file-name">{f.name}</span>
                      <span className="bh-file-meta">
                        {formatFileSize(f.size)} · {formatDriveDate(f.modifiedTime)}
                      </span>
                      <MoreHorizontal size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div
            className={`bh-dropzone ${uploadActive ? 'active' : ''}`}
            onClick={() => setUploadActive(!uploadActive)}
          >
            <Upload size={32} style={{ color: 'var(--color-text-muted)' }} />
            <span>Dra filer hit eller tryck för att ladda upp</span>
          </div>
        </div>
      )}

      {/* ═══ KALENDER ═══ */}
      {tab === 'kalender' && (
        <div className="bh-section">
          <div className="bh-cal-header">
            <button className="bh-cal-arrow" onClick={prevMonth}><ChevronLeft size={18} /></button>
            <span style={{ fontSize: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}>
              {MONTH_NAMES_SV[calMonth.month]} {calMonth.year}
            </span>
            <button className="bh-cal-arrow" onClick={nextMonth}><ChevronRight size={18} /></button>
          </div>
          <div className="bh-cal-daynames">
            {['MÅN', 'TIS', 'ONS', 'TOR', 'FRE', 'LÖR', 'SÖN'].map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="bh-cal-grid">
            {getCalendarDays(calMonth.year, calMonth.month).map((cell, i) => {
              const isToday =
                cell.current &&
                cell.day === today.getDate() &&
                calMonth.month === today.getMonth() &&
                calMonth.year === today.getFullYear();
              const dotColor = cell.current ? eventDotMap[cell.day] : undefined;
              return (
                <div key={i} className={`bh-cal-cell ${!cell.current ? 'other' : ''} ${isToday ? 'today' : ''}`}>
                  <span className={`bh-cal-num ${isToday ? 'today-num' : ''}`}>{cell.day}</span>
                  {dotColor && (
                    <div className="bh-cal-dots">
                      <span className="bh-cal-dot" style={{ background: dotColor }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {tabError.kalender && (
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-warning)', padding: 'var(--space-sm) 0' }}>
              {tabError.kalender}
            </div>
          )}

          {loading.kalender ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xl)' }}>
              <Spinner />
            </div>
          ) : (
            <>
              <div className="bh-section-label" style={{ marginTop: 'var(--space-lg)' }}>KOMMANDE</div>
              <div className="bh-upcoming-list">
                {events.slice(0, 8).map((ev) => (
                  <div key={ev.id} className="bh-upcoming-row">
                    <span className="bh-date-pill">{formatEventDate(ev)}</span>
                    <span style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', flex: 1 }}>
                      {ev.summary}
                    </span>
                    <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                      {formatEventTime(ev)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="bh-full-btn" onClick={handleCreateEvent}>
            <Plus size={16} /> Lägg till i bandkalendern
          </button>
        </div>
      )}

      {/* ═══ DOKUMENT ═══ */}
      {tab === 'dokument' && (
        <div className="bh-section">
          <div className="bh-header-row">
            <span />
            <button className="bh-action-btn" onClick={() => setShowNewDoc(true)}>
              <FilePlus size={14} /> Nytt dokument
            </button>
          </div>

          {tabError.dokument && (
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-warning)', padding: 'var(--space-sm) 0' }}>
              {tabError.dokument}
            </div>
          )}

          {loading.dokument ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xl)' }}>
              <Spinner />
            </div>
          ) : (
            <>
              <div className="bh-section-label">DOKUMENT</div>
              <div className="bh-file-list">
                {docs.map((d) => (
                  <button
                    key={d.id}
                    className="bh-file-row"
                    onClick={() => d.webViewLink
                      ? window.open(d.webViewLink, '_blank')
                      : setSelectedDoc(d)
                    }
                  >
                    <FileText size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                    <span className="bh-file-name">{d.name}</span>
                    <span className="bh-file-meta">
                      {getDocAuthor(d)} · {formatDriveDate(d.modifiedTime)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ SHEETS ═══ */}
      {tab === 'sheets' && (
        <div className="bh-section">
          {tabError.sheets && (
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-warning)', padding: 'var(--space-sm) 0' }}>
              {tabError.sheets}
            </div>
          )}

          {loading.sheets ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xl)' }}>
              <Spinner />
            </div>
          ) : (
            <div className="bh-sheets-list">
              {sheets.map((s) => {
                const { Icon, color } = sheetIcon(s);
                return (
                  <button
                    key={s.id}
                    className="bh-sheet-card"
                    onClick={() => s.webViewLink
                      ? window.open(s.webViewLink, '_blank')
                      : setSelectedSheet(s)
                    }
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <Icon size={24} style={{ color }} />
                      <div>
                        <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                          Senast ändrad av {getSheetAuthor(s)} · {formatDriveDate(s.modifiedTime)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <button className="bh-full-btn">
            <Plus size={16} /> Nytt kalkylark
          </button>
        </div>
      )}

      {/* ── File bottom sheet ── */}
      <BottomSheet open={!!selectedFile} onClose={() => setSelectedFile(null)}>
        {selectedFile && (() => {
          const { icon: Icon, color } = fileIconProps(selectedFile);
          return (
            <div className="bh-sheet-content">
              <Icon size={48} style={{ color }} />
              <div style={{ fontSize: 'var(--text-subheading)', color: 'var(--color-text-primary)', fontWeight: 600, marginTop: 'var(--space-md)' }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                {formatFileSize(selectedFile.size)} · {formatDriveDate(selectedFile.modifiedTime)}
              </div>
              {selectedFile.webViewLink ? (
                <button
                  className="bh-primary-btn"
                  onClick={() => window.open(selectedFile.webViewLink, '_blank')}
                >
                  Öppna i Google Drive
                </button>
              ) : (
                <button className="bh-primary-btn" disabled>Öppna i Google Drive</button>
              )}
              <button
                className="bh-secondary-btn"
                onClick={async () => {
                  try {
                    const url = await getFileUrl(selectedFile.id);
                    await navigator.clipboard.writeText(url);
                  } catch { /* ignore */ }
                }}
              >
                Dela länk
              </button>
            </div>
          );
        })()}
      </BottomSheet>

      {/* ── Doc bottom sheet ── */}
      <BottomSheet open={!!selectedDoc} onClose={() => setSelectedDoc(null)}>
        {selectedDoc && (
          <div className="bh-sheet-content">
            <FileText size={48} style={{ color: 'var(--color-primary)' }} />
            <div style={{ fontSize: 'var(--text-subheading)', color: 'var(--color-text-primary)', fontWeight: 600, marginTop: 'var(--space-md)' }}>
              {selectedDoc.name}
            </div>
            <button
              className="bh-primary-btn"
              onClick={() => window.open(getDocUrl(selectedDoc.id), '_blank')}
            >
              Öppna i Google Docs
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ── Sheet bottom sheet ── */}
      <BottomSheet open={!!selectedSheet} onClose={() => setSelectedSheet(null)}>
        {selectedSheet && (() => {
          const { Icon, color } = sheetIcon(selectedSheet);
          return (
            <div className="bh-sheet-content">
              <Icon size={48} style={{ color }} />
              <div style={{ fontSize: 'var(--text-subheading)', color: 'var(--color-text-primary)', fontWeight: 600, marginTop: 'var(--space-md)' }}>
                {selectedSheet.name}
              </div>
              <button
                className="bh-primary-btn"
                onClick={() => window.open(getSheetUrl(selectedSheet.id), '_blank')}
              >
                Öppna i Google Sheets
              </button>
            </div>
          );
        })()}
      </BottomSheet>

      {/* ── New doc bottom sheet ── */}
      <BottomSheet open={showNewDoc} onClose={() => setShowNewDoc(false)}>
        <div className="bh-sheet-content">
          <input
            className="bh-doc-input"
            type="text"
            placeholder="Dokumentnamn..."
            value={newDocTitle}
            onChange={e => setNewDocTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateDoc()}
            autoFocus
          />
          <div className="bh-template-cards">
            <div className="bh-template-card selected">
              <div className="bh-template-thumb" />
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-primary)' }}>Tomt dokument</span>
            </div>
            <div className="bh-template-card">
              <div className="bh-template-thumb" />
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-primary)' }}>Mötesanteckningar</span>
            </div>
          </div>
          <button
            className="bh-primary-btn"
            onClick={handleCreateDoc}
            disabled={!newDocTitle.trim() || !authed}
          >
            {authed ? 'Skapa' : 'Logga in för att skapa'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Public export: wraps BandHubInner with GoogleOAuthProvider
══════════════════════════════════════════════════════════ */
export default function BandHub() {
  if (!CLIENT_ID) {
    return (
      <div style={{
        padding: 'var(--space-xl)',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--text-caption)',
      }}>
        <GoogleLogo size={32} />
        <p style={{ marginTop: 'var(--space-sm)' }}>
          Sätt <code>VITE_GOOGLE_CLIENT_ID</code> i <code>.env.local</code> för att aktivera Google-integration.
        </p>
        <p style={{ marginTop: 4 }}>Se <code>GOOGLE_SETUP.md</code> för instruktioner.</p>
      </div>
    );
  }

  return (
    <BandHubErrorBoundary>
      <GoogleOAuthProvider clientId={CLIENT_ID}>
        <BandHubInner />
      </GoogleOAuthProvider>
    </BandHubErrorBoundary>
  );
}
