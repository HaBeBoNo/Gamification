import React, { useState } from 'react';
import { S, save, defChar } from '@/state/store';
import { MEMBERS, Member, MEMBER_IDS } from '@/data/members';
import { BASE_QUESTS } from '@/data/quests';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';
import { awardMetricPts } from '@/hooks/useXP';
import { wasQuestCompletedByMember } from '@/lib/questUtils';

interface AdminCenterProps {
  onClose: () => void;
  rerender: () => void;
}

const TABS = ['Quests', 'Medlemmar', 'Metrics', 'Säsong'] as const;
type Tab = typeof TABS[number];

const CATEGORIES = ['daily', 'personal', 'strategic', 'social', 'hidden', 'sidequest'];
const RECUR_OPTS = ['none', 'weekly', 'monthly'];

export default function AdminCenter({ onClose, rerender }: AdminCenterProps) {
  const [tab, setTab] = useState<Tab>('Quests');

  return (
    <AnimatePresence>
      <motion.div
        className="ac-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="ac-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="ac-header">
          <div className="ac-title">Admin Center</div>
          <button className="ac-close" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="ac-tabs">
          {TABS.map(t => (
            <button
              key={t}
              className={`ac-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >{t}</button>
          ))}
        </div>

        <div className="ac-body">
          {tab === 'Quests' && <QuestsTab rerender={rerender} />}
          {tab === 'Medlemmar' && <MembersTab rerender={rerender} />}
          {tab === 'Metrics' && <MetricsTab rerender={rerender} />}
          {tab === 'Säsong' && <SeasonTab rerender={rerender} />}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Tab 1: Quests ── */
function QuestsTab({ rerender }: { rerender: () => void }) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [bonusMember, setBonusMember] = useState('');
  const [bonusXP, setBonusXP] = useState('');
  const [bonusNote, setBonusNote] = useState('');

  const quest = editIdx !== null ? S.quests[editIdx] : null;

  function updateField(field: string, value: any) {
    if (editIdx === null) return;
    S.quests[editIdx] = { ...S.quests[editIdx], [field]: value };
    save();
    rerender();
  }

  function handleBonusXP() {
    if (!bonusMember || !bonusXP) return;
    const amount = parseInt(bonusXP) || 0;
    if (!amount) return;
    if (!S.chars[bonusMember]) S.chars[bonusMember] = defChar(bonusMember);
    S.chars[bonusMember].xp += amount;
    S.chars[bonusMember].totalXp += amount;
    save();
    rerender();
    setBonusXP('');
    setBonusNote('');
  }

  return (
    <div className="ac-quests-list">
      {S.quests.map((q: any, i: number) => {
        const ownerMember = q.owner ? MEMBERS[q.owner] : null;
        return (
          <button key={q.id || i} className="ac-quest-row" onClick={() => setEditIdx(i)}>
            <div className={`quest-cat-dot cat-${q.cat || 'global'}`} />
            <div className="ac-quest-info">
              <span className="ac-quest-title">{q.title}</span>
              <span className="ac-quest-owner">{ownerMember?.name || '—'}</span>
            </div>
            <span className="ac-quest-xp">{q.xp} XP</span>
          </button>
        );
      })}

      {/* Edit sheet */}
      <AnimatePresence>
        {quest && editIdx !== null && (
          <>
            <motion.div
              className="ac-sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditIdx(null)}
            />
            <motion.div
              className="ac-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 40 }}
            >
              <div className="deleg-handle" />
              <div className="ac-sheet-content">
                <label className="ac-field-label">Titel</label>
                <input
                  className="ac-field-input"
                  value={quest.title}
                  onChange={e => updateField('title', e.target.value)}
                />

                <label className="ac-field-label">XP</label>
                <input
                  className="ac-field-input"
                  type="number"
                  value={quest.xp}
                  onChange={e => updateField('xp', parseInt(e.target.value) || 0)}
                />

                <label className="ac-field-label">Kategori</label>
                <div className="ac-segmented">
                  {CATEGORIES.map(c => (
                    <button
                      key={c}
                      className={`ac-seg-btn ${quest.cat === c ? 'active' : ''}`}
                      onClick={() => updateField('cat', c)}
                    >{c}</button>
                  ))}
                </div>

                <label className="ac-field-label">Upprepning</label>
                <div className="ac-segmented">
                  {RECUR_OPTS.map(r => (
                    <button
                      key={r}
                      className={`ac-seg-btn ${(quest.recur || 'none') === r ? 'active' : ''}`}
                      onClick={() => updateField('recur', r)}
                    >{r}</button>
                  ))}
                </div>

                <div className="ac-divider" />

                <label className="ac-field-label">Tilldela bonus-XP</label>
                <div className="ac-bonus-row">
                  <select className="ac-field-input" value={bonusMember} onChange={e => setBonusMember(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Välj medlem</option>
                    {MEMBER_IDS.map(id => <option key={id} value={id}>{MEMBERS[id].name}</option>)}
                  </select>
                  <input className="ac-field-input" type="number" placeholder="XP" value={bonusXP} onChange={e => setBonusXP(e.target.value)} style={{ width: 80 }} />
                </div>
                <input className="ac-field-input" placeholder="Notering (valfritt)" value={bonusNote} onChange={e => setBonusNote(e.target.value)} />
                <button className="ac-primary-btn" onClick={handleBonusXP} disabled={!bonusMember || !bonusXP}>Tilldela bonus-XP</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Tab 2: Members ── */
function MembersTab({ rerender }: { rerender: () => void }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [bonusXP, setBonusXP] = useState('');
  const [bonusNote, setBonusNote] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);

  function handleBonusXP() {
    if (!detailId || !bonusXP) return;
    const amount = parseInt(bonusXP) || 0;
    if (!amount) return;
    if (!S.chars[detailId]) S.chars[detailId] = defChar(detailId);
    S.chars[detailId].xp += amount;
    S.chars[detailId].totalXp += amount;
    save();
    rerender();
    setBonusXP('');
    setBonusNote('');
  }

  function handleResetQuests() {
    if (!detailId) return;
    if (!resetConfirm) { setResetConfirm(true); return; }
    S.quests = S.quests.map((q: any) =>
      q.owner === detailId ? { ...q, done: false, aiVerdict: null } : q
    );
    save();
    rerender();
    setResetConfirm(false);
  }

  const detail = detailId ? { member: MEMBERS[detailId], char: S.chars[detailId] } : null;
  const completedCount = detailId ? (S.quests || []).filter((q: any) => wasQuestCompletedByMember(q, detailId)).length : 0;
  const totalCount = detailId ? (S.quests || []).filter((q: any) => q.owner === detailId).length : 0;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      <div className="ac-members-grid">
        {MEMBER_IDS.map(id => {
          const m = MEMBERS[id];
          const c = S.chars[id];
          return (
            <button key={id} className="ac-member-card" onClick={() => { setDetailId(id); setResetConfirm(false); }}>
              <MemberIcon id={id} size={32} color={m.xpColor} />
              <span className="ac-member-name">{m.name}</span>
              <span className="ac-member-xp">{c?.totalXp || 0} XP</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {detail && detailId && (
          <>
            <motion.div className="ac-sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDetailId(null)} />
            <motion.div
              className="ac-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 40 }}
            >
              <div className="deleg-handle" />
              <div className="ac-sheet-content">
                <div className="ac-member-detail-head">
                  <MemberIcon id={detailId} size={40} color={detail.member.xpColor} />
                  <div>
                    <div className="ac-quest-title">{detail.member.name}</div>
                    <div className="ac-quest-owner">{detail.member.role}</div>
                  </div>
                </div>

                <div className="ac-stat-row">
                  <div className="ac-stat"><span className="ac-stat-val">{detail.char?.totalXp || 0}</span><span className="ac-stat-lbl">Total XP</span></div>
                  <div className="ac-stat"><span className="ac-stat-val">Lv {detail.char?.level || 1}</span><span className="ac-stat-lbl">Level</span></div>
                  <div className="ac-stat"><span className="ac-stat-val">{completionRate}%</span><span className="ac-stat-lbl">Slutfört</span></div>
                  <div className="ac-stat"><span className="ac-stat-val">{detail.char?.streak || 0}</span><span className="ac-stat-lbl">Streak</span></div>
                </div>

                <div className="ac-divider" />

                <label className="ac-field-label">Ge bonus-XP</label>
                <div className="ac-bonus-row">
                  <input className="ac-field-input" type="number" placeholder="XP" value={bonusXP} onChange={e => setBonusXP(e.target.value)} style={{ width: 100 }} />
                  <input className="ac-field-input" placeholder="Notering" value={bonusNote} onChange={e => setBonusNote(e.target.value)} style={{ flex: 1 }} />
                </div>
                <button className="ac-primary-btn" onClick={handleBonusXP} disabled={!bonusXP}>Ge bonus-XP</button>

                <div className="ac-divider" />

                <button className={`ac-warning-btn ${resetConfirm ? 'confirmed' : ''}`} onClick={handleResetQuests}>
                  {resetConfirm ? 'Bekräfta — Återställ quests' : 'Återställ quests'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Tab 3: Metrics ── */
function MetricsTab({ rerender }: { rerender: () => void }) {
  const [vals, setVals] = useState({ ...S.metrics });

  const fields = [
    { key: 'spf', label: 'Spotify Followers', icon: '🎵' },
    { key: 'str', label: 'Streams', icon: '▶️' },
    { key: 'ig', label: 'Instagram', icon: '📷' },
    { key: 'x', label: 'Japan X', icon: '🗾' },
    { key: 'tix', label: 'Tickets', icon: '🎟️' },
  ];

  function handleChange(key: string, val: string) {
    setVals(v => ({ ...v, [key]: Number(val) || 0 }));
  }

  function handleSave() {
    const deltas: Record<string, number> = {};
    Object.keys(vals).forEach(k => {
      deltas[k] = vals[k] - (S.metrics[k] || 0);
    });
    S.prev = { ...S.metrics };
    S.metrics = { ...vals };
    if (S.me) awardMetricPts(S.me, deltas);
    save();
    rerender();
  }

  return (
    <div className="ac-metrics">
      {fields.map(f => {
        const delta = vals[f.key] - (S.metrics[f.key] || 0);
        return (
          <div key={f.key} className="ac-metric-row">
            <span className="ac-metric-icon">{f.icon}</span>
            <span className="ac-metric-label">{f.label}</span>
            <input
              className="ac-field-input"
              type="number"
              value={vals[f.key] || 0}
              onChange={e => handleChange(f.key, e.target.value)}
              style={{ width: 120, textAlign: 'right' }}
            />
            {delta !== 0 && (
              <span className={`ac-metric-delta ${delta > 0 ? 'pos' : 'neg'}`}>
                {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}
              </span>
            )}
          </div>
        );
      })}
      <button className="ac-primary-btn ac-full-width" onClick={handleSave}>Spara</button>
    </div>
  );
}

/* ── Tab 4: Season ── */
function SeasonTab({ rerender }: { rerender: () => void }) {
  const [endStep, setEndStep] = useState(0);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');

  function handleEndSeason() {
    if (endStep === 0) { setEndStep(1); return; }
    // Second tap — reset (visual shell, no protected file changes)
    Object.keys(S.chars).forEach(id => {
      S.chars[id].xp = 0;
      S.chars[id].totalXp = 0;
      S.chars[id].level = 1;
      S.chars[id].xpToNext = 100;
      S.chars[id].questsDone = 0;
      S.chars[id].streak = 0;
    });
    S.quests = S.quests.map((q: any) => ({ ...q, done: false, aiVerdict: null }));
    save();
    rerender();
    setEndStep(0);
  }

  function handleExport() {
    const data = localStorage.getItem('sek-v6') || '{}';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sektionen-s${S.weekNum}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ac-season">
      <div className="ac-season-info">
        <div className="ac-field-label">Nuvarande säsong</div>
        <div className="ac-season-name">{S.operationName}</div>
        <div className="ac-season-date">Vecka {S.weekNum}</div>
      </div>

      <div className="ac-divider" />

      <button className={`ac-warning-btn ${endStep > 0 ? 'confirmed' : ''}`} onClick={handleEndSeason}>
        {endStep > 0 ? 'Bekräfta — Avsluta säsong' : 'Avsluta säsong'}
      </button>
      {endStep > 0 && (
        <p className="ac-warning-text">
          Detta nollställer alla XP och completade uppdrag. Kan inte ångras.
        </p>
      )}

      <div className="ac-divider" />

      <label className="ac-field-label">Ny säsong</label>
      <input className="ac-field-input" placeholder="Säsongsnamn" value={newName} onChange={e => setNewName(e.target.value)} />
      <input className="ac-field-input" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ marginTop: 'var(--space-sm)' }} />

      <div className="ac-divider" />

      <button className="ac-export-btn" onClick={handleExport}>
        <Download size={14} /> Exportera säsongsdata
      </button>
    </div>
  );
}
