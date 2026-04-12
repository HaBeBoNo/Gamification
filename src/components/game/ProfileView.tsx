import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Star, Flame, Target, Clock, Compass, LineChart } from 'lucide-react';
import { MEMBERS, ROLE_TYPE_LABEL } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import ActivityHeatmap from './ActivityHeatmap';
import { getFeedCommentMeta } from '@/lib/feed';
import { formatRelativeActivity, getFeedTimestampValue } from '@/lib/activityFeed';
import { isQuestDoneNow, isQuestRelevantToMember, wasQuestCompletedByMember } from '@/lib/questUtils';
import { S, useGameStore } from '@/state/store';
import type { FeedEntry } from '@/types/game';

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.18, level - 1));
}

function formatNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function getTemporalLabel(pattern?: string): string {
  switch (pattern) {
    case 'early':
      return 'Tidig avslutare';
    case 'deadline-driven':
      return 'Deadline-driven';
    case 'steady':
      return 'Jämn rytm';
    default:
      return 'Tar form';
  }
}

function getCategoryBreakdown(memberId: string) {
  const counts: Record<string, number> = {};
  const categories = ['wisdom', 'tech', 'social', 'money', 'health', 'global'];
  categories.forEach((category) => {
    counts[category] = 0;
  });

  (S.quests || []).forEach((quest: any) => {
    if (wasQuestCompletedByMember(quest, memberId) && categories.includes(quest.cat)) {
      counts[quest.cat] += 1;
    }
  });

  return counts;
}

function getDominantCategory(counts: Record<string, number>) {
  return Object.entries(counts).sort(([, left], [, right]) => right - left)[0] || ['wisdom', 0];
}

function getTopCategories(counts: Record<string, number>, limit = 2): string[] {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([, left], [, right]) => right - left)
    .slice(0, limit)
    .map(([category]) => category);
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

function truncateText(value: string, max = 78): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}...`;
}

function extractQuotedText(value: string): string | null {
  const match = value.match(/"([^"]+)"/);
  return match?.[1] || null;
}

function summarizeProfileFeedEntry(item: FeedEntry): { title: string; detail?: string } {
  const commentMeta = getFeedCommentMeta(item);
  if (commentMeta) {
    return {
      title: `Kommenterade ${commentMeta.targetName}`,
      detail: commentMeta.contextLabel === 'aktivitet'
        ? truncateText(commentMeta.comment || 'I tråden')
        : `${commentMeta.contextLabel} · ${truncateText(commentMeta.comment || 'Kommenterade')}`,
    };
  }

  const action = String(item.action || '').trim();
  const quoted = extractQuotedText(action);

  if (/completed\s+"/i.test(action) && quoted) {
    return { title: 'Klarade uppdrag', detail: quoted };
  }

  if (/reflekterade över/i.test(action) && quoted) {
    return { title: 'Reflekterade', detail: quoted };
  }

  if (/checkade in på/i.test(action)) {
    const place = action
      .replace(/^.*checkade in på\s*/i, '')
      .replace(/\s+[^\w\s]+$/g, '')
      .trim();
    return { title: 'Checkade in', detail: place || undefined };
  }

  if (/gav en high-five till/i.test(action)) {
    const target = action
      .replace(/^.*gav en high-five till\s*/i, '')
      .replace(/\s+[^\w\s]+$/g, '')
      .trim();
    return { title: 'Skickade energi', detail: target || undefined };
  }

  if (/anslöt sig till/i.test(action) && quoted) {
    return { title: 'Klev in i samarbete', detail: quoted };
  }

  if (/leveled up/i.test(action)) {
    const levelMatch = action.match(/level\s+\d+/i)?.[0];
    return { title: 'Nådde ny nivå', detail: levelMatch || undefined };
  }

  return { title: truncateText(action) };
}

function FormDots({ form, color }: { form: ('W' | 'L')[]; color: string }) {
  const dots = [...(form || [])];
  while (dots.length < 5) dots.unshift('L');

  return (
    <div className="pv-form-dots">
      {dots.map((dot, index) => (
        <div
          key={index}
          className="pv-form-dot"
          style={{
            background: dot === 'W' ? color : 'var(--color-surface-elevated)',
            boxShadow: dot === 'W' ? `0 0 6px ${color}40` : 'none',
          }}
        />
      ))}
    </div>
  );
}

export default function ProfileView() {
  useGameStore((state) => state.tick);
  const feed = useGameStore((state) => state.feed);

  const me = S.me || '';
  const member = (MEMBERS as Record<string, any>)[me];
  const character = S.chars[me];
  const questsDone = character?.questsDone || 0;
  const categoryCounts = useMemo(
    () => (me ? getCategoryBreakdown(me) : EMPTY_CAT_COUNTS),
    [me, questsDone],
  );

  if (!member || !character) return null;

  const xpColor = member.xpColor || 'var(--color-accent)';
  const level = character.level || 1;
  const xp = character.xp || 0;
  const xpToNext = character.xpToNext || xpForLevel(level);
  const totalXp = character.totalXp || 0;
  const streak = character.streak || 0;
  const stats = character.stats || { vit: 10, wis: 10, for: 10, cha: 10 };
  const form = character.form || [];
  const roleType = character.roleType || member.roleType || 'amplifier';
  const roleTypeLabel = (ROLE_TYPE_LABEL as Record<string, any>)[roleType];
  const temporalPattern = character.temporalBehavior?.pattern;
  const xpPercent = xpToNext > 0 ? Math.round((xp / xpToNext) * 100) : 0;
  const coachName = (character as any).coachName || ({
    hannes: 'Scout',
    martin: 'Brodern',
    niklas: 'Arkitekten',
    carl: 'Analytikern',
    nisse: 'Spegeln',
    simon: 'Rådgivaren',
    johannes: 'Kartläggaren',
    ludvig: 'Katalysatorn',
  } as Record<string, string>)[me] || 'Coach';
  const [dominantCategory, dominantCount] = getDominantCategory(categoryCounts);
  const focusLabel = dominantCount > 0 ? CAT_LABELS[dominantCategory] : 'Tar form';
  const topCategories = useMemo(
    () => getTopCategories(categoryCounts, 2),
    [categoryCounts],
  );
  const topCategoryLabels = topCategories.map((category) => CAT_LABELS[category]);
  const coachReading = getCoachReading({
    motivation: character.motivation,
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
  ].sort((left, right) => right.value - left.value);
  const strongestStat = strengthRows[0];
  const xpRemaining = Math.max(0, xpToNext - xp);
  const rhythmLabel = getTemporalLabel(temporalPattern);
  const focusSubline = topCategoryLabels.length > 0 ? topCategoryLabels.join(' · ') : 'Riktningen tar form';
  const openQuestCount = (S.quests || []).filter((quest: any) => (
    isQuestRelevantToMember(quest, me) && !isQuestDoneNow(quest) && !wasQuestCompletedByMember(quest, me)
  )).length;

  const recentProfileEntries = useMemo(() => {
    const seen = new Set<string>();

    return [...(feed || [])]
      .filter((item) => item?.who === me && (item.action || item.comment_body))
      .sort((left, right) => getFeedTimestampValue(right) - getFeedTimestampValue(left))
      .filter((item) => {
        const key = String(item.id || item.syncId || `${item.action}|${getFeedTimestampValue(item)}`);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3)
      .map((item) => ({
        ...summarizeProfileFeedEntry(item),
        age: formatRelativeActivity(getFeedTimestampValue(item)),
      }));
  }, [feed, me]);

  return (
    <div className="pv-view">
      <motion.div
        className="pv-hero"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div
          className="pv-hero-bg"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${xpColor}15 0%, transparent 70%)` }}
        />
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
            <div className="pv-role-type" style={{ color: roleTypeLabel?.labelColor || xpColor }}>
              {roleTypeLabel?.label || roleType}
            </div>
          </div>
        </div>

        <div className="pv-voice-card">
          <div className="pv-voice-kicker">{coachName} om dig just nu</div>
          <div className="pv-voice-body">{coachReading}</div>
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
            <Flame size={12} />
            <span>{streak} dagar</span>
          </div>
          <div className="pv-hero-chip">
            <Compass size={12} />
            <span>{openQuestCount} öppna</span>
          </div>
          <div className="pv-hero-chip">
            <Star size={12} />
            <span>{formatNumber(totalXp)} total XP</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="pv-section pv-state-section"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
      >
        <div className="pv-section-header">
          <Compass size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="pv-section-title">Läge nu</span>
        </div>
        <div className="pv-state-shell">
          <div className="pv-state-focus" style={{ borderColor: `${xpColor}2E` }}>
            <span className="pv-state-focus-label">Riktning</span>
            <span className="pv-state-focus-value">{focusLabel}</span>
            <span className="pv-state-focus-sub">{focusSubline}</span>
          </div>
          <div className="pv-state-list">
            <div className="pv-state-row">
              <span className="pv-state-row-label">Tempo</span>
              <span className="pv-state-row-value">{rhythmLabel}</span>
              <span className="pv-state-row-meta">{formWins}/5 senaste steg med fart</span>
            </div>
            <div className="pv-state-row">
              <span className="pv-state-row-label">Öppna uppdrag</span>
              <span className="pv-state-row-value">{openQuestCount}</span>
              <span className="pv-state-row-meta">{questsDone} klara totalt</span>
            </div>
            <div className="pv-state-row">
              <span className="pv-state-row-label">Nästa nivå</span>
              <span className="pv-state-row-value">{formatNumber(xpRemaining)} XP</span>
              <span className="pv-state-row-meta">{xpPercent}% av nivån fylld</span>
            </div>
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
          <span className="pv-section-title">Rörelse</span>
        </div>
        <div className="pv-rhythm-top">
          <div className="pv-rhythm-copy">
            <div className="pv-rhythm-title">{rhythmLabel}</div>
            <div className="pv-rhythm-sub">Senaste veckornas tempo och belastning.</div>
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
        className="pv-section pv-trace-section"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.2 }}
      >
        <div className="pv-section-header">
          <LineChart size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="pv-section-title">Senaste avtryck</span>
        </div>
        <div className="pv-trace-list">
          {recentProfileEntries.length > 0 ? recentProfileEntries.map((item, index) => (
            <div key={`${item.title}-${index}`} className="pv-trace-row">
              <div className="pv-trace-head">
                <span className="pv-trace-title">{item.title}</span>
                <span className="pv-trace-age">{item.age}</span>
              </div>
              {item.detail ? <span className="pv-trace-detail">{item.detail}</span> : null}
            </div>
          )) : (
            <div className="pv-trace-empty">Dina senaste spår landar här.</div>
          )}
        </div>
      </motion.div>

      <motion.div
        className="pv-section pv-signature-section"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.25 }}
      >
        <div className="pv-section-header">
          <Target size={14} style={{ color: 'var(--color-text-muted)' }} />
          <span className="pv-section-title">Profilsignatur</span>
        </div>
        <div className="pv-strength-lead">
          <div>
            <div className="pv-strength-head">{strongestStat.label}</div>
            <div className="pv-strength-sub">Tydligast i ditt uttryck just nu</div>
          </div>
          <div className="pv-signature-tags">
            <span className="pv-signature-tag">{roleTypeLabel?.label || roleType}</span>
            {topCategoryLabels.slice(0, 2).map((label) => (
              <span key={label} className="pv-signature-tag">{label}</span>
            ))}
          </div>
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
    </div>
  );
}
