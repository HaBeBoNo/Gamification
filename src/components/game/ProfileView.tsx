import React, { useMemo, type CSSProperties } from 'react';
import { Compass, Flame, Star, Target, Zap } from 'lucide-react';
import { MEMBERS } from '@/data/members';
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
      return 'Svarar i skarpt läge';
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
  focusLabel,
}: {
  motivation?: string;
  streak: number;
  temporalPattern?: string;
  focusLabel: string;
}) {
  if (motivation?.trim()) return motivation.trim();

  const tempoText = {
    early: 'Startar tidigt när riktningen är tydlig.',
    'deadline-driven': 'Växlar upp när läget blir skarpt.',
    steady: 'Bygger bäst i jämn rytm.',
  }[temporalPattern || ''] || 'Rör sig bäst när uppgiften känns direkt relevant.';

  const streakText = streak >= 3 ? ' Streaken bär just nu.' : ' Nästa steg sätter tonen.';

  return `${tempoText} Fokus ligger mot ${focusLabel.toLowerCase()}.${streakText}`;
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

const subtleCardStyle: CSSProperties = {
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

function InfoRow({
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
      gap: 10,
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
  const focusLabel = dominantCount > 0 ? CAT_LABELS[dominantCategory] : 'Tar form';
  const rhythmLabel = getTemporalLabel(temporalPattern);
  const xpRemaining = Math.max(0, xpToNext - xp);
  const openQuestCount = (S.quests || []).filter((quest: any) => (
    isQuestRelevantToMember(quest, me) && !isQuestDoneNow(quest) && !wasQuestCompletedByMember(quest, me)
  )).length;
  const coachReading = getCoachReading({
    motivation: character.motivation,
    streak,
    temporalPattern,
    focusLabel,
  });

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
    <div style={viewStyle}>
      <SurfaceCard style={{
        background: `linear-gradient(180deg, ${xpColor}12 0%, var(--color-surface-elevated) 46%, var(--color-surface-elevated) 100%)`,
      }}>
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
                marginBottom: 6,
              }}>
                {member.role}
              </div>
              <div style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-muted)',
                lineHeight: 1.45,
              }}>
                Fokus just nu: {focusLabel.toLowerCase()}
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
          ...subtleCardStyle,
          background: 'color-mix(in srgb, var(--color-surface) 74%, transparent)',
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
            {coachName} om dig
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
              {xpRemaining} XP till nivå {level + 1}
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
          label="Fokus"
          value={focusLabel}
          detail={rhythmLabel}
        />
      </div>

      <section>
        <SectionEyebrow title="Läge nu" />
        <SurfaceCard>
          <div style={{ marginTop: -12 }}>
            <InfoRow
              label="Rörelse"
              value={rhythmLabel}
              meta={`${openQuestCount} öppna uppdrag just nu`}
              accent={xpColor}
            />
            <InfoRow
              label="Nästa nivå"
              value={`${formatNumber(xpRemaining)} XP`}
              meta={`${xpPercent}% av nivån fylld`}
              accent={xpColor}
            />
            <InfoRow
              label="Riktning"
              value={focusLabel}
              meta="Det område du tydligast drar mot just nu"
              accent={xpColor}
            />
          </div>
        </SurfaceCard>
      </section>

      <section>
        <SectionEyebrow title="Rörelse" />
        <SurfaceCard>
          <div style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
            marginBottom: 12,
          }}>
            Senaste veckornas rytm och slutföranden.
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
    </div>
  );
}
