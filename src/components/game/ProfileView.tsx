import React, { useMemo } from 'react';
import { S, useGameStore } from '@/state/store';
import { MEMBERS, ROLE_TYPE_LABEL } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import ActivityHeatmap from './ActivityHeatmap';
import { Star, Flame, Zap, Target, Clock, Compass, LineChart } from 'lucide-react';
import { motion } from 'framer-motion';
import { wasQuestCompletedByMember } from '@/lib/questUtils';

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
    if (wasQuestCompletedByMember(q, memberId) && cats.includes(q.cat)) {
      counts[q.cat]++;
    }
  });
  return counts;
}

function getDominantCategory(counts: Record<string, number>) {
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0] || ['wisdom', 0];
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
  wisdom: 'Visdom',
  tech: 'Teknik',
  social: 'Socialt',
  money: 'Ekonomi',
  health: 'Hälsa',
  global: 'Globalt',
};

const EMPTY_CAT_COUNTS: Record<string, number> = {
  wisdom: 0,
  tech: 0,
  social: 0,
  money: 0,
  health: 0,
  global: 0,
};

function getCoachReading({
  motivation,
  streak,
  temporalPattern,
  dominantCategory,
}: {
  motivation?: string;
  streak: number;
  temporalPattern?: string;
  dominantCategory: string;
}) {
  if (motivation?.trim()) return motivation.trim();

  const paceMap: Record<string, string> = {
    early: 'Du går ofta igång tidigt när riktningen är tydlig.',
    'deadline-driven': 'Du svarar starkt när det finns ett skarpt läge att möta.',
    steady: 'Du bygger bäst när du får hålla en stadig rytm över tid.',
  };

  const categoryPart = CAT_LABELS[dominantCategory]
    ? `Just nu dras du mest mot ${CAT_LABELS[dominantCategory].toLowerCase()}.`
    : 'Just nu håller din riktning fortfarande på att ta form.';
  const streakPart = streak >= 3
    ? ' Streaken visar att du redan är inne i rörelse.'
    : ' Nästa steg blir viktigt för att sätta rytmen.';

  return `${paceMap[temporalPattern || ''] || 'Du rör dig bäst när uppdraget känns relevant direkt.'} ${categoryPart}${streakPart}`;
}

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
  const questsDone = char?.questsDone || 0;
  const catCounts = useMemo(
    () => (me ? getCategoryBreakdown(me) : EMPTY_CAT_COUNTS),
    [me, questsDone],
  );
  if (!member || !char) return null;

  const xpColor = member.xpColor || 'var(--color-accent)';
  const level = char.level || 1;
  const xp = char.xp || 0;
  const xpToNext = char.xpToNext || xpForLevel(level);
  const totalXp = char.totalXp || 0;
  const streak = char.streak || 0;
  const stats = char.stats || { vit: 10, wis: 10, for: 10, cha: 10 };
  const form = char.form || [];
  const roleType = char.roleType || member.roleType || 'amplifier';
  const rtLabel = (ROLE_TYPE_LABEL as Record<string, any>)[roleType];
  const temporalPattern = char.temporalBehavior?.pattern;
  const xpPercent = xpToNext > 0 ? Math.round((xp / xpToNext) * 100) : 0;
  const coachName = (char as any).coachName ||
    ({ hannes: 'Scout', martin: 'Brodern', niklas: 'Arkitekten', carl: 'Analytikern',
       nisse: 'Spegeln', simon: 'Rådgivaren', johannes: 'Kartläggaren', ludvig: 'Katalysatorn'
    } as Record<string, string>)[me] || 'Coach';
  const [dominantCategory, dominantCount] = getDominantCategory(catCounts);
  const focusLabel = dominantCount > 0 ? CAT_LABELS[dominantCategory] : 'Tar form';
  const coachReading = getCoachReading({
    motivation: char.motivation,
    streak,
    temporalPattern,
    dominantCategory,
  });
  const formWins = form.filter((entry) => entry === 'W').length;

  return (
    <div className="pv-view">
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

        <div className="pv-hero-strip">
          <div className="pv-hero-chip">
            <Compass size={12} />
            <span>{focusLabel}</span>
          </div>
          <div className="pv-hero-chip">
            <LineChart size={12} />
            <span>{coachName}</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="pv-section pv-glance-section"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
      >
        <div className="pv-section-header">
          <Target size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="pv-section-title">LÄGET JUST NU</span>
        </div>
        <div className="pv-glance-grid">
          <div className="pv-stat-card pv-glance-card">
            <Target size={16} style={{ color: xpColor }} />
            <span className="pv-stat-value">{questsDone}</span>
            <span className="pv-stat-label">Uppdrag</span>
            <span className="pv-stat-helper">gjorda hittills</span>
          </div>
          <div className="pv-stat-card pv-glance-card">
            <Flame size={16} style={{ color: streak >= 7 ? '#f59e0b' : streak >= 3 ? xpColor : 'var(--color-text-muted)' }} />
            <span className="pv-stat-value">{streak}</span>
            <span className="pv-stat-label">Streak</span>
            <span className="pv-stat-helper">dagar i rörelse</span>
          </div>
          <div className="pv-stat-card pv-glance-card">
            <Clock size={16} style={{ color: 'var(--color-text-muted)' }} />
            <span className="pv-stat-value pv-stat-value-text">{getTemporalLabel(temporalPattern)}</span>
            <span className="pv-stat-label">Arbetsstil</span>
            <span className="pv-stat-helper">så brukar du arbeta</span>
          </div>
          <div className="pv-stat-card pv-glance-card">
            <Zap size={16} style={{ color: xpColor }} />
            <span className="pv-stat-value pv-stat-value-text">{focusLabel}</span>
            <span className="pv-stat-label">Fokus</span>
            <span className="pv-stat-helper">där du växer mest</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="pv-composer-grid"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.15 }}
      >
        <div className="pv-radar-card">
          <div className="pv-section-label">KARAKTÄR</div>
          <div className="pv-character-layout">
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
        </div>

        <div className="pv-form-card pv-focus-card">
          <div className="pv-section-label">ARBETSMÖNSTER</div>
          <div className="pv-focus-summary">
            <div className="pv-focus-copy">
              <span className="pv-focus-head">Form senaste fem</span>
              <span className="pv-focus-sub">
                {formWins} av 5 steg sattes med tydlig framdrift.
              </span>
            </div>
            <FormDots form={form} color={xpColor} />
          </div>
          <div className="pv-section-label pv-section-label-spaced">TYNGDPUNKT</div>
          <CategoryBars counts={catCounts} color={xpColor} />
        </div>
      </motion.div>

      <motion.div
        className="pv-section"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.2 }}
      >
        <div className="pv-section-header">
          <LineChart size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="pv-section-title">DIN RYTM</span>
        </div>
        <ActivityHeatmap memberId={me} xpColor={xpColor} />
      </motion.div>

      <motion.div
        className="pv-coach-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.25 }}
      >
        <div className="pv-section-label">COACHENS LÄSNING</div>
        <div className="pv-coach-name" style={{ color: xpColor }}>{coachName}</div>
        <div className="pv-coach-motivation">
          <span className="pv-coach-quote-label">Just nu</span>
          <span className="pv-coach-quote">{coachReading}</span>
        </div>
        <div className="pv-coach-tags">
          <span className="pv-coach-tag">{rtLabel?.label || roleType}</span>
          <span className="pv-coach-tag">{focusLabel}</span>
        </div>
      </motion.div>
    </div>
  );
}
