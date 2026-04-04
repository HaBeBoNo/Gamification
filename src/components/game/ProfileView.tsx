import React, { useMemo } from 'react';
import { S, useGameStore } from '@/state/store';
import { MEMBERS, ROLE_TYPES, ROLE_TYPE_LABEL } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import SkillNodes from './SkillNodes';
import TrophyRoom from './TrophyRoom';
import ActivityHeatmap from './ActivityHeatmap';
import { Star, Flame, Zap, Target, Calendar, TrendingUp, Award, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

// ── Helpers ──────────────────────────────────────────────────────

function xpForLevel(lv: number): number {
  return Math.floor(100 * Math.pow(1.18, lv - 1));
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function getTemporalLabel(pattern?: string): string {
  switch (pattern) {
    case 'early': return 'Tidig Avslutare';
    case 'deadline-driven': return 'Deadline-driven';
    case 'steady': return 'Stadig Arbetare';
    default: return 'Utforskar...';
  }
}

function getCategoryBreakdown(memberId: string) {
  const counts: Record<string, number> = {};
  const cats = ['wisdom', 'tech', 'social', 'money', 'health', 'global'];
  cats.forEach(c => { counts[c] = 0; });
  (S.quests || []).forEach((q: any) => {
    if (q.done && (q.owner === memberId || q.completedBy === memberId) && cats.includes(q.cat)) {
      counts[q.cat]++;
    }
  });
  return counts;
}

const CAT_COLORS: Record<string, string> = {
  wisdom: 'var(--cat-wisdom)',
  tech: 'var(--cat-tech)',
  social: 'var(--cat-social)',
  money: 'var(--cat-money)',
  health: 'var(--cat-health)',
  global: 'var(--cat-global)',
};

const CAT_LABELS: Record<string, string> = {
  wisdom: 'Wisdom',
  tech: 'Tech',
  social: 'Social',
  money: 'Money',
  health: 'Health',
  global: 'Global',
};

// ── Stat Radar (compact SVG) ────────────────────────────────────

interface RadarProps {
  stats: { vit: number; wis: number; for: number; cha: number };
  color: string;
}

function StatRadar({ stats, color }: RadarProps) {
  const labels = [
    { key: 'vit', label: 'VIT', angle: -90 },
    { key: 'wis', label: 'WIS', angle: 0 },
    { key: 'cha', label: 'CHA', angle: 90 },
    { key: 'for', label: 'FOR', angle: 180 },
  ];

  const cx = 60, cy = 60, maxR = 44;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Background rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Data points
  const points = labels.map(l => {
    const val = Math.min(100, (stats as any)[l.key] || 10);
    const r = (val / 100) * maxR;
    const rad = toRad(l.angle);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  });

  const polygon = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={120} height={120} viewBox="0 0 120 120" className="pv-radar">
      {/* Rings */}
      {rings.map((r, i) => (
        <polygon
          key={i}
          points={labels.map(l => {
            const rad = toRad(l.angle);
            const dist = r * maxR;
            return `${cx + dist * Math.cos(rad)},${cy + dist * Math.sin(rad)}`;
          }).join(' ')}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={0.5}
        />
      ))}
      {/* Axes */}
      {labels.map((l, i) => {
        const rad = toRad(l.angle);
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + maxR * Math.cos(rad)}
            y2={cy + maxR * Math.sin(rad)}
            stroke="var(--color-border)"
            strokeWidth={0.5}
          />
        );
      })}
      {/* Data polygon */}
      <polygon
        points={polygon}
        fill={`${color}20`}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
      ))}
      {/* Labels */}
      {labels.map((l, i) => {
        const rad = toRad(l.angle);
        const labelR = maxR + 12;
        const lx = cx + labelR * Math.cos(rad);
        const ly = cy + labelR * Math.sin(rad);
        return (
          <text
            key={i}
            x={lx} y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--color-text-muted)"
            fontSize={8}
            fontFamily="var(--font-mono)"
            letterSpacing="0.06em"
          >
            {l.label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Form Dots (last 5 quest results) ────────────────────────────

function FormDots({ form, color }: { form: ('W' | 'L')[]; color: string }) {
  const dots = [...(form || [])];
  while (dots.length < 5) dots.unshift('L'); // pad to 5

  return (
    <div className="pv-form-dots">
      {dots.map((d, i) => (
        <div
          key={i}
          className="pv-form-dot"
          style={{
            background: d === 'W' ? color : 'var(--color-surface-elevated)',
            boxShadow: d === 'W' ? `0 0 6px ${color}40` : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ── Category Bar Chart ──────────────────────────────────────────

function CategoryBars({ counts, color }: { counts: Record<string, number>; color: string }) {
  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="pv-cat-bars">
      {Object.entries(counts).map(([cat, count]) => (
        <div key={cat} className="pv-cat-bar-row">
          <span className="pv-cat-bar-label" style={{ color: CAT_COLORS[cat] }}>{CAT_LABELS[cat]}</span>
          <div className="pv-cat-bar-track">
            <motion.div
              className="pv-cat-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${(count / max) * 100}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ background: CAT_COLORS[cat] }}
            />
          </div>
          <span className="pv-cat-bar-value">{count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Profile View ───────────────────────────────────────────

export default function ProfileView() {
  // Subscribe to Zustand for reactivity
  useGameStore(s => s.tick);

  const me = S.me || '';
  const member = (MEMBERS as Record<string, any>)[me];
  const char = S.chars[me];
  if (!member || !char) return null;

  const xpColor = member.xpColor || 'var(--color-accent)';
  const level = char.level || 1;
  const xp = char.xp || 0;
  const xpToNext = char.xpToNext || xpForLevel(level);
  const totalXp = char.totalXp || 0;
  const questsDone = char.questsDone || 0;
  const streak = char.streak || 0;
  const stats = char.stats || { vit: 10, wis: 10, for: 10, cha: 10 };
  const form = char.form || [];
  const roleType = char.roleType || member.roleType || 'amplifier';
  const rtLabel = (ROLE_TYPE_LABEL as Record<string, any>)[roleType];
  const temporalPattern = char.temporalBehavior?.pattern;
  const xpPercent = xpToNext > 0 ? Math.round((xp / xpToNext) * 100) : 0;

  const catCounts = useMemo(() => getCategoryBreakdown(me), [me, questsDone]);

  // Season progress
  const seasonStart = new Date(S.seasonStart || '2026-03-01');
  const seasonEnd = new Date(S.seasonEnd || '2026-07-31');
  const now = new Date();
  const seasonTotal = seasonEnd.getTime() - seasonStart.getTime();
  const seasonElapsed = Math.max(0, now.getTime() - seasonStart.getTime());
  const seasonPercent = Math.min(100, Math.round((seasonElapsed / seasonTotal) * 100));

  // Work points total
  const pts = char.pts || { work: 0, spotify: 0, social: 0, bonus: 0 };
  const totalPts = pts.work + pts.spotify + pts.social + pts.bonus;

  // Coach name
  const coachName = (char as any).coachName ||
    ({ hannes: 'Scout', martin: 'Brodern', niklas: 'Arkitekten', carl: 'Analytikern',
       nisse: 'Spegeln', simon: 'Rådgivaren', johannes: 'Kartläggaren', ludvig: 'Katalysatorn'
    } as Record<string, string>)[me] || 'Coach';

  return (
    <div className="pv-view">
      {/* ── Hero Card ── */}
      <motion.div
        className="pv-hero"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="pv-hero-bg" style={{ background: `radial-gradient(ellipse at 50% 0%, ${xpColor}15 0%, transparent 70%)` }} />

        <div className="pv-hero-top">
          <div className="pv-avatar">
            <MemberIcon id={me} size={56} color={xpColor} />
            <div className="pv-level-badge" style={{ background: xpColor }}>
              <Star size={10} strokeWidth={2.5} />
              <span>{level}</span>
            </div>
          </div>

          <div className="pv-hero-info">
            <div className="pv-name">{member.name}</div>
            <div className="pv-role">{member.role}</div>
            <div className="pv-role-type" style={{ color: rtLabel?.labelColor || xpColor }}>
              {member.emoji} {rtLabel?.label || roleType}
            </div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="pv-xp-section">
          <div className="pv-xp-labels">
            <span className="pv-xp-current">{formatNumber(xp)} XP</span>
            <span className="pv-xp-next">Nivå {level + 1}: {formatNumber(xpToNext)} XP</span>
          </div>
          <div className="pv-xp-track">
            <motion.div
              className="pv-xp-fill"
              initial={{ width: 0 }}
              animate={{ width: `${xpPercent}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ background: `linear-gradient(90deg, ${xpColor}, ${xpColor}CC)` }}
            />
          </div>
          <div className="pv-xp-total">{formatNumber(totalXp)} total XP</div>
        </div>
      </motion.div>

      {/* ── Quick Stats Grid ── */}
      <motion.div
        className="pv-stats-grid"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
      >
        <div className="pv-stat-card">
          <Target size={16} style={{ color: xpColor }} />
          <span className="pv-stat-value">{questsDone}</span>
          <span className="pv-stat-label">Uppdrag</span>
        </div>
        <div className="pv-stat-card">
          <Flame size={16} style={{ color: streak >= 7 ? '#f59e0b' : streak >= 3 ? xpColor : 'var(--color-text-muted)' }} />
          <span className="pv-stat-value">{streak}</span>
          <span className="pv-stat-label">Streak</span>
        </div>
        <div className="pv-stat-card">
          <Zap size={16} style={{ color: xpColor }} />
          <span className="pv-stat-value">{formatNumber(totalPts)}</span>
          <span className="pv-stat-label">Poäng</span>
        </div>
        <div className="pv-stat-card">
          <Clock size={16} style={{ color: 'var(--color-text-muted)' }} />
          <span className="pv-stat-value" style={{ fontSize: '0.75rem' }}>{getTemporalLabel(temporalPattern)}</span>
          <span className="pv-stat-label">Arbetsstil</span>
        </div>
      </motion.div>

      {/* ── Form + Radar Row ── */}
      <motion.div
        className="pv-radar-section"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.15 }}
      >
        <div className="pv-radar-card">
          <div className="pv-section-label">KARAKTÄRSSTATS</div>
          <StatRadar stats={stats} color={xpColor} />
          <div className="pv-stat-row-grid">
            {[
              { key: 'vit', label: 'Vitalitet' },
              { key: 'wis', label: 'Visdom' },
              { key: 'for', label: 'Styrka' },
              { key: 'cha', label: 'Karisma' },
            ].map(s => (
              <div key={s.key} className="pv-stat-mini">
                <span className="pv-stat-mini-label">{s.label}</span>
                <span className="pv-stat-mini-value" style={{ color: xpColor }}>
                  {(stats as any)[s.key] || 10}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pv-form-card">
          <div className="pv-section-label">SENASTE FORM</div>
          <FormDots form={form} color={xpColor} />
          <div className="pv-section-label" style={{ marginTop: 16 }}>KATEGORIER</div>
          <CategoryBars counts={catCounts} color={xpColor} />
        </div>
      </motion.div>

      {/* ── Activity Heatmap ── */}
      <motion.div
        className="pv-section"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.2 }}
      >
        <div className="pv-section-header">
          <Calendar size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="pv-section-title">AKTIVITET</span>
        </div>
        <ActivityHeatmap memberId={me} xpColor={xpColor} />
      </motion.div>

      {/* ── Skill Trees ── */}
      <motion.div
        className="pv-section"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.25 }}
      >
        <div className="pv-section-header">
          <TrendingUp size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="pv-section-title">FRAMSTEG</span>
        </div>
        <SkillNodes />
      </motion.div>

      {/* ── Trophy Room ── */}
      <motion.div
        className="pv-section"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.3 }}
      >
        <div className="pv-section-header">
          <Award size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="pv-section-title">MÄRKEN</span>
        </div>
        <TrophyRoom />
      </motion.div>

      {/* ── Season Progress ── */}
      <motion.div
        className="pv-season-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.35 }}
      >
        <div className="pv-section-label">{S.operationName || 'SÄSONG'}</div>
        <div className="pv-season-bar-track">
          <div
            className="pv-season-bar-fill"
            style={{ width: `${seasonPercent}%`, background: xpColor }}
          />
        </div>
        <div className="pv-season-labels">
          <span>{seasonStart.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}</span>
          <span style={{ color: xpColor }}>{seasonPercent}%</span>
          <span>{seasonEnd.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}</span>
        </div>
      </motion.div>

      {/* ── Coach Info ── */}
      <motion.div
        className="pv-coach-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.4 }}
      >
        <div className="pv-section-label">DIN COACH</div>
        <div className="pv-coach-name" style={{ color: xpColor }}>{coachName}</div>
        {char.motivation && (
          <div className="pv-coach-motivation">
            <span className="pv-coach-quote-label">Drivkraft</span>
            <span className="pv-coach-quote">"{char.motivation}"</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
