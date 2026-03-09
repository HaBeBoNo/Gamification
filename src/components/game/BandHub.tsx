import React, { useState } from 'react';
import { FolderOpen, Calendar, FileText, Table2, Upload, Search, Music, Image, MoreHorizontal, ChevronLeft, ChevronRight, Plus, FilePlus, BarChart2, List, Paperclip, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TABS = [
  { id: 'drive', label: 'Drive', icon: FolderOpen },
  { id: 'kalender', label: 'Kalender', icon: Calendar },
  { id: 'dokument', label: 'Dokument', icon: FileText },
  { id: 'sheets', label: 'Sheets', icon: Table2 },
];

/* ── Drive data ── */
const FOLDERS = [
  { name: 'Inspelningar', icon: Music, color: 'var(--color-accent)', count: '14 filer' },
  { name: 'Bilder', icon: Image, color: 'var(--color-primary)', count: '38 filer' },
  { name: 'Dokument', icon: FileText, color: 'var(--color-text-secondary)', count: '7 filer' },
];

const FILE_ICONS: Record<string, { icon: typeof Music; color: string }> = {
  Music: { icon: Music, color: 'var(--color-accent)' },
  Image: { icon: Image, color: 'var(--color-primary)' },
  FileText: { icon: FileText, color: 'var(--color-text-secondary)' },
  Table: { icon: Table2, color: 'var(--color-accent)' },
};

const FILES = [
  { type: 'Music', name: 'Arms_demo_v3.wav', size: '4.2 MB', date: 'Idag' },
  { type: 'Music', name: 'Praise_You_stems.zip', size: '18 MB', date: 'Igår' },
  { type: 'Image', name: 'Ölslanda_konsert.jpg', size: '3.1 MB', date: '7 mars' },
  { type: 'FileText', name: 'Bidragsansökan_VGR.docx', size: '240 KB', date: '6 mars' },
  { type: 'Music', name: 'Ignited_rough_mix.mp3', size: '8.7 MB', date: '5 mars' },
  { type: 'Table', name: 'Budget_2026.xlsx', size: '156 KB', date: '4 mars' },
  { type: 'Image', name: 'Cover_art_II_final.png', size: '2.4 MB', date: '1 mars' },
  { type: 'FileText', name: 'Spelningskontrakt_Q2.pdf', size: '89 KB', date: '28 feb' },
];

/* ── Calendar data ── */
const EVENTS = [
  { day: 9, month: 3, name: 'Rep Lerum 18:00', color: 'var(--color-accent)' },
  { day: 15, month: 3, name: 'Styrelsemöte 14:00', color: 'var(--color-primary)' },
  { day: 22, month: 3, name: 'Studiosession Martin', color: 'var(--color-text-secondary)' },
  { day: 29, month: 3, name: 'Spelning Göteborg TBC', color: 'var(--color-accent)' },
  { day: 5, month: 4, name: 'Truminspelning (block)', color: 'var(--color-warning)' },
];

const UPCOMING = [
  { date: '9 mar', name: 'Rep Lerum', time: '18:00' },
  { date: '15 mar', name: 'Styrelsemöte', time: '14:00' },
  { date: '22 mar', name: 'Studiosession Martin', time: 'Heldag' },
  { date: '29 mar', name: 'Spelning Göteborg', time: 'TBC' },
  { date: '5 apr', name: 'Truminspelning', time: 'Block' },
];

/* ── Documents data ── */
const SHARED_DOCS = [
  { name: 'Sektionen — Stadgar 2024', author: 'Ludvig', date: '15 jan' },
  { name: 'Turné-rider Q2 2026', author: 'Johannes', date: '3 mars' },
  { name: 'Presskit — Album II', author: 'Hannes', date: '28 feb' },
  { name: 'Bidragsansökan Västra Götaland', author: 'Carl', date: '6 mars' },
  { name: 'EP-produktionsplan', author: 'Martin', date: '2 mars' },
];

const MY_DOCS = [
  { name: 'Veckorapport v8', date: 'Idag' },
  { name: 'Outreach-strategi Japan', date: '5 mars' },
  { name: 'Kontaktlista press', date: '1 mars' },
];

/* ── Sheets data ── */
const SHEETS = [
  { name: 'Budget 2026', icon: Table2, color: 'var(--color-accent)', author: 'Simon', date: '4 mars', cols: ['Kategori', 'Budget', 'Utfall'] },
  { name: 'Metrics & Streams', icon: BarChart2, color: 'var(--color-primary)', author: 'Hannes', date: 'Idag', cols: ['Plattform', 'Streams', 'Trend'] },
  { name: 'Setlista — Spelningar 2026', icon: List, color: 'var(--color-text-secondary)', author: 'Johannes', date: '28 feb', cols: ['Datum', 'Plats', 'Status'] },
];

/* ── Google G logo SVG ── */
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

/* ── Bottom sheet wrapper ── */
function BottomSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="overflow-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="overflow-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
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
  const offset = firstDay === 0 ? 6 : firstDay - 1; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const days: { day: number; current: boolean }[] = [];
  for (let i = offset - 1; i >= 0; i--) days.push({ day: daysInPrev - i, current: false });
  for (let i = 1; i <= daysInMonth; i++) days.push({ day: i, current: true });
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) days.push({ day: i, current: false });
  return days;
}

export default function BandHub() {
  const [tab, setTab] = useState('drive');
  const [selectedFile, setSelectedFile] = useState<typeof FILES[0] | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<typeof SHEETS[0] | null>(null);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [uploadActive, setUploadActive] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  return (
    <div className="bh-root">
      {/* Connect banner */}
      {showBanner && (
        <div className="bh-banner">
          <button className="bh-banner-close" onClick={() => setShowBanner(false)}><X size={14} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <GoogleLogo size={32} />
            <div>
              <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', fontWeight: 600 }}>Koppla Google</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>Anslut ditt Google-konto för att se bandets riktiga filer och kalender</div>
            </div>
          </div>
          <button className="bh-connect-btn">Anslut</button>
        </div>
      )}

      {/* Tab row */}
      <div className="bh-tabs">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={`qf-pill ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <Icon size={14} style={{ marginRight: 4, verticalAlign: '-2px' }} />{t.label}
            </button>
          );
        })}
      </div>

      {/* ═══ DRIVE ═══ */}
      {tab === 'drive' && (
        <div className="bh-section">
          <div className="bh-header-row">
            <span style={{ fontSize: 'var(--text-heading)', fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>Sektionen</span>
            <button className="bh-action-btn"><Upload size={14} /> Ladda upp</button>
          </div>
          <div className="bh-search">
            <Search size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input type="text" placeholder="Sök i bandmappen..." />
          </div>
          <div className="bh-folders">
            {FOLDERS.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.name} className="bh-folder-card">
                  <Icon size={24} style={{ color: f.color }} />
                  <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', fontWeight: 500, marginTop: 'var(--space-sm)' }}>{f.name}</div>
                  <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{f.count}</div>
                </div>
              );
            })}
          </div>
          <div className="bh-section-label">SENASTE FILER</div>
          <div className="bh-file-list">
            {FILES.map((f, i) => {
              const fi = FILE_ICONS[f.type];
              const Icon = fi.icon;
              return (
                <button key={i} className="bh-file-row" onClick={() => setSelectedFile(f)}>
                  <Icon size={16} style={{ color: fi.color, flexShrink: 0 }} />
                  <span className="bh-file-name">{f.name}</span>
                  <span className="bh-file-meta">{f.size} · {f.date}</span>
                  <MoreHorizontal size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
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
            <button className="bh-cal-arrow"><ChevronLeft size={18} /></button>
            <span style={{ fontSize: 'var(--text-heading)', fontFamily: 'var(--font-heading)' }}>Mars 2026</span>
            <button className="bh-cal-arrow"><ChevronRight size={18} /></button>
          </div>
          <div className="bh-cal-daynames">
            {['MÅN', 'TIS', 'ONS', 'TOR', 'FRE', 'LÖR', 'SÖN'].map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="bh-cal-grid">
            {getCalendarDays(2026, 2).map((cell, i) => {
              const isToday = cell.current && cell.day === 9;
              const dayEvents = cell.current ? EVENTS.filter(e => e.day === cell.day && e.month === 3) : [];
              return (
                <div key={i} className={`bh-cal-cell ${!cell.current ? 'other' : ''} ${isToday ? 'today' : ''}`}>
                  <span className={`bh-cal-num ${isToday ? 'today-num' : ''}`}>{cell.day}</span>
                  {dayEvents.length > 0 && (
                    <div className="bh-cal-dots">
                      {dayEvents.slice(0, 3).map((e, j) => (
                        <span key={j} className="bh-cal-dot" style={{ background: e.color }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="bh-section-label" style={{ marginTop: 'var(--space-lg)' }}>KOMMANDE</div>
          <div className="bh-upcoming-list">
            {UPCOMING.map((ev, i) => (
              <div key={i} className="bh-upcoming-row">
                <span className="bh-date-pill">{ev.date}</span>
                <span style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', flex: 1 }}>{ev.name}</span>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{ev.time}</span>
              </div>
            ))}
          </div>
          <button className="bh-full-btn">
            <Plus size={16} /> Lägg till i bandkalendern
          </button>
        </div>
      )}

      {/* ═══ DOKUMENT ═══ */}
      {tab === 'dokument' && (
        <div className="bh-section">
          <div className="bh-header-row">
            <span />
            <button className="bh-action-btn" onClick={() => setShowNewDoc(true)}><FilePlus size={14} /> Nytt dokument</button>
          </div>
          <div className="bh-section-label">DELADE DOKUMENT</div>
          <div className="bh-file-list">
            {SHARED_DOCS.map((d, i) => (
              <button key={i} className="bh-file-row" onClick={() => setSelectedDoc(d.name)}>
                <FileText size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span className="bh-file-name">{d.name}</span>
                <span className="bh-file-meta">{d.author} · {d.date}</span>
              </button>
            ))}
          </div>
          <div className="bh-section-label" style={{ marginTop: 'var(--space-lg)' }}>MINA DOKUMENT</div>
          <div className="bh-file-list">
            {MY_DOCS.map((d, i) => (
              <button key={i} className="bh-file-row" onClick={() => setSelectedDoc(d.name)}>
                <FileText size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span className="bh-file-name">{d.name}</span>
                <span className="bh-file-meta">{d.date}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ SHEETS ═══ */}
      {tab === 'sheets' && (
        <div className="bh-section">
          <div className="bh-sheets-list">
            {SHEETS.map((s, i) => {
              const Icon = s.icon;
              return (
                <button key={i} className="bh-sheet-card" onClick={() => setSelectedSheet(s)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <Icon size={24} style={{ color: s.color }} />
                    <div>
                      <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>Senast ändrad av {s.author} · {s.date}</div>
                    </div>
                  </div>
                  <div className="bh-sheet-preview">
                    {s.cols.map((c, j) => (
                      <span key={j} className="bh-sheet-col">{c}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <button className="bh-full-btn">
            <Plus size={16} /> Nytt kalkylark
          </button>
        </div>
      )}

      {/* ── File bottom sheet ── */}
      <BottomSheet open={!!selectedFile} onClose={() => setSelectedFile(null)}>
        {selectedFile && (() => {
          const fi = FILE_ICONS[selectedFile.type];
          const Icon = fi.icon;
          return (
            <div className="bh-sheet-content">
              <Icon size={48} style={{ color: fi.color }} />
              <div style={{ fontSize: 'var(--text-subheading)', color: 'var(--color-text-primary)', fontWeight: 600, marginTop: 'var(--space-md)' }}>{selectedFile.name}</div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>{selectedFile.size} · {selectedFile.date}</div>
              <button className="bh-primary-btn">Öppna i Google Drive</button>
              <button className="bh-secondary-btn">Dela länk</button>
            </div>
          );
        })()}
      </BottomSheet>

      {/* ── Doc bottom sheet ── */}
      <BottomSheet open={!!selectedDoc} onClose={() => setSelectedDoc(null)}>
        <div className="bh-sheet-content">
          <FileText size={48} style={{ color: 'var(--color-primary)' }} />
          <div style={{ fontSize: 'var(--text-subheading)', color: 'var(--color-text-primary)', fontWeight: 600, marginTop: 'var(--space-md)' }}>{selectedDoc}</div>
          <button className="bh-primary-btn">Öppna i Google Docs</button>
        </div>
      </BottomSheet>

      {/* ── Sheet bottom sheet ── */}
      <BottomSheet open={!!selectedSheet} onClose={() => setSelectedSheet(null)}>
        {selectedSheet && (
          <div className="bh-sheet-content">
            <selectedSheet.icon size={48} style={{ color: selectedSheet.color }} />
            <div style={{ fontSize: 'var(--text-subheading)', color: 'var(--color-text-primary)', fontWeight: 600, marginTop: 'var(--space-md)' }}>{selectedSheet.name}</div>
            <button className="bh-primary-btn">Öppna i Google Sheets</button>
            <button className="bh-secondary-btn">Visa senaste ändringar</button>
          </div>
        )}
      </BottomSheet>

      {/* ── New doc bottom sheet ── */}
      <BottomSheet open={showNewDoc} onClose={() => setShowNewDoc(false)}>
        <div className="bh-sheet-content">
          <input className="bh-doc-input" type="text" placeholder="Dokumentnamn..." />
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
          <button className="bh-primary-btn">Skapa</button>
        </div>
      </BottomSheet>
    </div>
  );
}
