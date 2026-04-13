import React, { useMemo, type CSSProperties } from 'react';
import {
  Compass,
  Flame,
  Star,
  Target,
  Zap,
} from 'lucide-react';
import { MEMBERS, ROLE_TYPE_LABEL } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import ActivityHeatmap from './ActivityHeatmap';
import { getFeedCommentMeta } from '@/lib/feed';
import { formatRelativeActivity, getFeedTimestampValue } from '@/lib/activityFeed';
import { isQuestDoneNow, isQuestRelevantToMember, wasQuestCompletedByMember } from '@/lib/questUtils';
import { S, useGameStore } from '@/state/store';
import type { FeedEntry } from '@/types/game';
import { SectionEyebrow } from '@/components/game/bandhub/SectionEyebrow';
import { StatCard } from '@/components/game/bandhub/StatCard';

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
      return 'Svarar på skarpt läge';
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
    'deadline-driven': 'Växlar upp när läget blir skarpt.',
    steady: 'Bygger bäst i jämn rytm.',
  };

  const categoryPart = CAT_LABELS[dominantCategory]
    ? `Drar mot ${CAT_LABELS[dominantCategory].toLowerCase()}.`
    : 'Riktningen tar form.';
  const streakPart = streak >= 3
    ? ' Streaken bär just nu.'
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

const viewStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--section-gap)',
  padding: 'var(--section-gap) var(--layout-gutter-room) 0',
  paddingBottom: 'var(--space-2xl)',
};

const cardStyle: CSSProperties = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-card)',
  padding: 'var(--card-padding-room)',
  minWidth: 0,
};

const compactCardStyle: CSSProperties = {
  ...cardStyle,
  padding: 'var(--card-padding)',
};

function SurfaceCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return <div style={{ ...cardStyle, ...style }}>{children}</div>;
}

function MetaPill({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      minHeight: 28,
      padding: '0 10px',
      borderRadius: '999px',
      background: color ? `${color}18` : 'var(--color-surface)',
      border: `1px solid ${color ? `${color}33` : 'var(--color-border)'}`,
      color: color || 'var(--color-text-muted)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-micro)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function MetricRow({
  label,
  value,
  meta,
  accent,
}: {
  label: string;
  value: string;
  meta?: string;
  accent?: string;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      gap: 8,
      padding: '12px 0',
      borderTop: '1px solid var(--color-border)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-muted)',
          marginBottom: 4,
        }}>
          {label}
        </div>
        {meta ? (
          <div style={{
            fontSize: 'var(--text-micro)',
            color: 'var(--color-text-muted)',
            lineHeight: 1.45,
          }}>
            {meta}
          </div>
        ) : null}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-caption)',
        fontWeight: 700,
        color: accent || 'var(--color-text)',
        textAlign: 'right',
        alignSelf: 'center',
      }}>
        {value}
      </div>
    </div>
  );
}

function FormDots({ form, color }: { form: ('W' | 'L')[]; color: string }) {
  const dots = [...(form || [])];
  while (dots.length < 5) dots.unshift('L');

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
      {dots.map((dot, index) => (
        <div
          key={index}
          style={{
            width: 10,
            height: 10,
            borderRadius: '999px',
            background: dot === 'W' ? color : 'var(--color-surface)',
            border: `1px solid ${dot === 'W' ? `${color}66` : 'var(--color-border)'}`,
            boxShadow: dot === 'W' ? `0 0 10px ${color}33` : 'none',
          }}
        />
      ))}
    </div>
  );
}

export default function ProfileView() {
  const feed = useGameStore((state) => state.feed);
  const tick = useGameStore((state) => state.tick);

  const me = S.me || '';
  const member = (MEMBERS as Record<string, any>)[me];
  const character = S.chars[me];

  const categoryCounts = useMemo(
    () => (me ? getCategoryBreakdown(me) : EMPTY_CAT_COUNTS),
    [me, tick],
  );

  if (!member || !character) return null;

  const xpColor = member.xpColor || 'var(--color-accent)';
  const level = character.level || 1;
  const xp = character.xp || 0;
  const xpToNext = character.xpToNext || xpForLevel(level);
  const totalXp = character.totalXp || 0;
  const streak = character.streak || 0;
  const questsDone = character.questsDone || 0;
  const stats = character.stats || { vit: 10, wis: 10, for: 10, cha: 10 };
  const form = character.form || [];
  const roleType = character.roleType || member.roleType || 'amplifier';
  const roleTypeLabel = (ROLE_TYPE_LABEL as Record<string, any>)[roleType];
  const temporalPattern = character.temporalBehavior?.pattern;
  const xpPercent = xpToNext > 0 ? Math.max(0, Math.min(100, Math.round((xp / xpToNext) * 100))) : 0;
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
  const topCategories = useMemo(
    () => getTopCategories(categoryCounts, 2),
    [categoryCounts],
  );
  const topCategoryLabels = topCategories.map((category) => CAT_LABELS[category]);
  const focusLabel = dominantCount > 0 ? CAT_LABELS[dominantCategory] : 'Tar form';
  const focusSubline = topCategoryLabels.length > 0 ? topCategoryLabels.join(' · ') : 'Riktningen sätter sig';
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
      .slice(0, 4)
      .map((item) => ({
        ...summarizeProfileFeedEntry(item),
        age: formatRelativeActivity(getFeedTimestampValue(item)),
      }));
  }, [feed, me]);

  return (
    <div style={viewStyle}>
      <SurfaceCard style={{
        position: 'relative',
        overflow: 'hidden',
        background: `linear-gradient(180deg, ${xpColor}14 0%, var(--color-surface-elevated) 42%, var(--color-surface-elevated) 100%)`,
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at top right, ${xpColor}18 0%, transparent 48%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative' }}>
          <SectionEyebrow title="Profil" />

          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{
                width: 68,
                height: 68,
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${xpColor}18`,
                border: `1px solid ${xpColor}2A`,
                flexShrink: 0,
              }}>
                <MemberIcon id={me} size={34} color={xpColor} />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'clamp(1.25rem, 4.8vw, 1.85rem)',
                  lineHeight: 1.05,
                  color: 'var(--color-text)',
                  marginBottom: 4,
                }}>
                  {member.name}
                </div>
                <div style={{
                  fontSize: 'var(--text-body)',
                  color: 'var(--color-text)',
                  marginBottom: 8,
                }}>
                  {member.role}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <MetaPill color={roleTypeLabel?.color || xpColor}>
                    {roleTypeLabel?.label || roleType}
                  </MetaPill>
                  <MetaPill color={CAT_COLORS[dominantCategory]}>
                    {focusLabel}
                  </MetaPill>
                </div>
              </div>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 32,
              padding: '0 12px',
              borderRadius: '999px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-caption)',
              fontWeight: 700,
              flexShrink: 0,
            }}>
              <Star size={13} strokeWidth={2.2} style={{ color: xpColor }} />
              Nivå {level}
            </div>
          </div>

          <div style={{
            ...compactCardStyle,
            background: 'color-mix(in srgb, var(--color-surface) 68%, transparent)',
            marginBottom: 16,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}>
              {coachName} om dig just nu
            </div>
            <div style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text)',
              lineHeight: 1.6,
            }}>
              {coachReading}
            </div>
          </div>

          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'baseline',
              marginBottom: 8,
              flexWrap: 'wrap',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-subheading)',
                fontWeight: 700,
                color: 'var(--color-text)',
              }}>
                {formatNumber(xp)} XP
              </div>
              <div style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
              }}>
                {xpRemaining} XP kvar till nivå {level + 1}
              </div>
            </div>

            <div style={{
              width: '100%',
              height: 10,
              borderRadius: '999px',
              background: 'var(--color-surface)',
              overflow: 'hidden',
              border: '1px solid var(--color-border)',
              marginBottom: 8,
            }}>
              <div style={{
                width: `${xpPercent}%`,
                height: '100%',
                borderRadius: '999px',
                background: `linear-gradient(90deg, ${xpColor}, ${xpColor}CC)`,
                boxShadow: `0 0 18px ${xpColor}44`,
              }} />
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              fontSize: 'var(--text-micro)',
              color: 'var(--color-text-muted)',
            }}>
              <span>{formatNumber(totalXp)} total XP</span>
              <span>{xpPercent}% av nivån fylld</span>
            </div>
          </div>
        </div>
      </SurfaceCard>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10,
      }}>
        <StatCard
          icon={<Flame size={15} />}
          label="Streak"
          value={String(streak)}
          detail={streak === 1 ? 'dag i rad' : 'dagar i rad'}
        />
        <StatCard
          icon={<Compass size={15} />}
          label="Öppna"
          value={String(openQuestCount)}
          detail="uppdrag nu"
        />
        <StatCard
          icon={<Target size={15} />}
          label="Klara"
          value={String(questsDone)}
          detail="slutförda totalt"
        />
        <StatCard
          icon={<Zap size={15} />}
          label="Nästa nivå"
          value={`${formatNumber(xpRemaining)} XP`}
          detail={`${xpPercent}% fylld`}
        />
      </div>

      <section>
        <SectionEyebrow title="Läge nu" />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}>
          <SurfaceCard style={{ borderColor: `${xpColor}33` }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-micro)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}>
              Riktning
            </div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(1.05rem, 4.4vw, 1.4rem)',
              lineHeight: 1.1,
              color: 'var(--color-text)',
              marginBottom: 6,
            }}>
              {focusLabel}
            </div>
            <div style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-muted)',
              lineHeight: 1.55,
            }}>
              {focusSubline}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div style={{ marginTop: -12 }}>
              <MetricRow
                label="Tempo"
                value={rhythmLabel}
                meta={`${formWins}/5 senaste steg med fart`}
                accent={xpColor}
              />
              <MetricRow
                label="Starkast just nu"
                value={strongestStat.label}
                meta={`${strongestStat.value} i ${strongestStat.label.toLowerCase()}`}
                accent={xpColor}
              />
              <MetricRow
                label="Roll i bandet"
                value={roleTypeLabel?.label || roleType}
                meta={member.role}
                accent={roleTypeLabel?.color || xpColor}
              />
            </div>
          </SurfaceCard>
        </div>
      </section>

      <section>
        <SectionEyebrow title="Rörelse" />
        <SurfaceCard>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 14,
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1rem, 4vw, 1.25rem)',
                color: 'var(--color-text)',
                lineHeight: 1.1,
                marginBottom: 4,
              }}>
                {rhythmLabel}
              </div>
              <div style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
              }}>
                Senaste veckornas rörelse och slutföranden.
              </div>
            </div>
            <FormDots form={form} color={xpColor} />
          </div>

          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 10,
          }}>
            <MetaPill color={xpColor}>{streak} dagar</MetaPill>
            <MetaPill>{openQuestCount} öppna</MetaPill>
            {topCategories.map((category) => (
              <MetaPill key={category} color={CAT_COLORS[category]}>
                {CAT_LABELS[category]}
              </MetaPill>
            ))}
          </div>

          <ActivityHeatmap memberId={me} xpColor={xpColor} />
        </SurfaceCard>
      </section>

      <section>
        <SectionEyebrow title="Senaste avtryck" />
        <SurfaceCard>
          {recentProfileEntries.length > 0 ? recentProfileEntries.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              style={{
                padding: index === 0 ? '0 0 14px' : '14px 0',
                borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: item.detail ? 4 : 0,
              }}>
                <span style={{
                  fontSize: 'var(--text-body)',
                  color: 'var(--color-text)',
                  fontWeight: 600,
                }}>
                  {item.title}
                </span>
                <span style={{
                  fontSize: 'var(--text-micro)',
                  color: 'var(--color-text-muted)',
                  whiteSpace: 'nowrap',
                }}>
                  {item.age}
                </span>
              </div>
              {item.detail ? (
                <div style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.55,
                }}>
                  {item.detail}
                </div>
              ) : null}
            </div>
          )) : (
            <div style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-muted)',
            }}>
              Dina senaste spår landar här.
            </div>
          )}
        </SurfaceCard>
      </section>

      <section>
        <SectionEyebrow title="Styrkor" />
        <SurfaceCard>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 14,
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1rem, 4vw, 1.25rem)',
                color: 'var(--color-text)',
                lineHeight: 1.1,
                marginBottom: 4,
              }}>
                {strongestStat.label}
              </div>
              <div style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
              }}>
                Tydligast i ditt uttryck just nu
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <MetaPill color={roleTypeLabel?.color || xpColor}>
                {roleTypeLabel?.label || roleType}
              </MetaPill>
              {topCategoryLabels.slice(0, 2).map((label, index) => (
                <MetaPill key={label} color={CAT_COLORS[topCategories[index]]}>
                  {label}
                </MetaPill>
              ))}
            </div>
          </div>

          <div>
            {strengthRows.map((row, index) => (
              <div
                key={row.key}
                style={{
                  paddingTop: index === 0 ? 0 : 14,
                  marginTop: index === 0 ? 0 : 14,
                  borderTop: index === 0 ? 'none' : '1px solid var(--color-border)',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 8,
                  alignItems: 'baseline',
                }}>
                  <span style={{
                    fontSize: 'var(--text-caption)',
                    color: 'var(--color-text)',
                    fontWeight: 600,
                  }}>
                    {row.label}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-caption)',
                    color: xpColor,
                    fontWeight: 700,
                  }}>
                    {row.value}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: 10,
                  borderRadius: '999px',
                  overflow: 'hidden',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}>
                  <div style={{
                    width: `${Math.min(100, row.value)}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: `linear-gradient(90deg, ${xpColor}AA, ${xpColor})`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </section>
    </div>
  );
}
