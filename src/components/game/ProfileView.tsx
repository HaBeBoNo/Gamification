import React, { useMemo } from 'react';
import { S, useGameStore } from '@/state/store';
import { MEMBERS, ROLE_TYPE_LABEL } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import ActivityHeatmap from './ActivityHeatmap';
import { Star, Flame, Target, Clock, Compass, LineChart } from 'lucide-react';
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
    default: return 'Tar form';
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

function getTopCategories(counts: Record<string, number>, limit = 2): string[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([cat]) => cat);
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
    early: 'Startar tidigt när riktningen är klar.',
    'deadline-driven': 'Svarar starkt på skarpa lägen.',
    steady: 'Bygger bäst i jämn rytm.',
  };

  const categoryPart = CAT_LABELS[dominantCategory]
    ? `Drar mot ${CAT_LABELS[dominantCategory].toLowerCase()}.`
    : 'Riktningen tar form.';
  const streakPart = streak >= 3
    ? ' Streaken är igång.'
    : ' Nästa steg sätter tonen.';

  return `${paceMap[temporalPattern || ''] || 'Rör sig bäst när uppgiften känns direkt relevant.'} ${categoryPart}${streakPart}`;
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
  const topCategories = useMemo(
    () => getTopCategories(catCounts, 2),
    [catCounts],
  );
  const coachReading = getCoachReading({
    motivation: char.motivation,
    streak,
    temporalPattern,
    dominantCategory,
  });
  const formWins = form.filter((entry) => entry === 'W').length;
  const strengthRows = [
    { key: 'vit', label: 'Vitalitet', value: stats.vit || 10 },
    { key: 'wis', label: 'Visdom', value: stats.wis || 10 },
    { key: 'for', label: 'Styrka', value: stats.for || 10 },
    { key: 'cha', label: 'Karisma', value: stats.cha || 10 },
  ].sort((a, b) => b.value - a.value);
  const strongestStat = strengthRows[0];
  const xpRemaining = Math.max(0, xpToNext - xp);
  const rhythmLabel = getTemporalLabel(temporalPattern);

  return (
    <div className="pv-view">
      <motion.div
        className="pv-hero"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="pv-hero-bg" style={{ background: `radial-gradient(ellipse at 50% 0%, ${xpColor}15 0%, transparent 70%)` }} />
        <div className="pv-kicker">Profil</div>

        <div className="pv-hero-top pv-hero-top-profile">
          <div className="pv-avatar">
            <MemberIcon id={me} size={56} color={xpColor} />
          </div>

          <div className="pv-hero-info">
            <div className="pv-name-row">
              <div className="pv-name">{member.name}</div>
              <div className="pv-inline-level">
                <Star size={11} strokeWidth={2.4} />
                <span>Nivå {level}</span>
              </div>
            </div>
            <div className="pv-role">{member.role}</div>
            <div className="pv-role-type" style={{ color: rtLabel?.labelColor || xpColor }}>
              {rtLabel?.label || roleType}
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
            <Clock size={12} />
            <span>{rhythmLabel}</span>
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
          <span className="pv-section-title">NU</span>
        </div>
        <div className="pv-now-grid">
          <div className="pv-now-card">
            <span className="pv-now-label">Fokus</span>
            <span className="pv-now-value pv-now-value-text">{focusLabel}</span>
            <span className="pv-now-meta">{dominantCount > 0 ? `${dominantCount} klart` : 'Tar form'}</span>
          </div>
          <div className="pv-now-card">
            <span className="pv-now-label">Rytm</span>
            <span className="pv-now-value pv-now-value-text">{rhythmLabel}</span>
            <span className="pv-now-meta">{formWins}/5 senaste med fart</span>
          </div>
          <div className="pv-now-card">
            <span className="pv-now-label">Streak</span>
            <span className="pv-now-value">{streak}</span>
            <span className="pv-now-meta">dagar i rad</span>
          </div>
          <div className="pv-now-card">
            <span className="pv-now-label">Nästa nivå</span>
            <span className="pv-now-value">{formatNumber(xpRemaining)}</span>
            <span className="pv-now-meta">XP kvar</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="pv-section pv-rhythm-section"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.15 }}
      >
        <div className="pv-section-header">
          <Clock size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="pv-section-title">RYTM</span>
        </div>
        <div className="pv-rhythm-top">
          <div className="pv-rhythm-copy">
            <div className="pv-rhythm-title">{rhythmLabel}</div>
            <div className="pv-rhythm-sub">Så här har du rört dig den senaste tiden.</div>
          </div>
          <FormDots form={form} color={xpColor} />
        </div>
        <div className="pv-rhythm-chips">
          <div className="pv-rhythm-chip">
            <Flame size={12} />
            <span>{streak} dagar</span>
          </div>
          <div className="pv-rhythm-chip">
            <Target size={12} />
            <span>{questsDone} klara</span>
          </div>
          <div className="pv-rhythm-chip">
            <Compass size={12} />
            <span>{focusLabel}</span>
          </div>
          {topCategories.map((category) => (
            <div
              key={category}
              className="pv-rhythm-chip"
              style={{ color: CAT_COLORS[category], borderColor: `${CAT_COLORS[category]}33` }}
            >
              <span>{CAT_LABELS[category]}</span>
            </div>
          ))}
        </div>
        <ActivityHeatmap memberId={me} xpColor={xpColor} />
      </motion.div>

      <motion.div
        className="pv-section"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.2 }}
      >
        <div className="pv-section-header">
          <Compass size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="pv-section-title">STYRKOR</span>
        </div>
        <div className="pv-strength-lead">
          <span className="pv-strength-head">{strongestStat.label}</span>
          <span className="pv-strength-sub">Tydligast just nu</span>
        </div>
        <div className="pv-strength-list">
          {strengthRows.map((row) => (
            <div key={row.key} className="pv-strength-row">
              <div className="pv-strength-copy">
                <span className="pv-strength-label">{row.label}</span>
                <span className="pv-strength-value" style={{ color: xpColor }}>{row.value}</span>
              </div>
              <div className="pv-strength-track">
                <motion.div
                  className="pv-strength-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, row.value)}%` }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: `linear-gradient(90deg, ${xpColor}AA, ${xpColor})` }}
                />
              </div>
            </div>
          ))}
        </div>
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
          <span className="pv-coach-quote-label">Läsning</span>
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
