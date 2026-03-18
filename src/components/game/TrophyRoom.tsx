import React from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { Lock } from 'lucide-react';
import { motion } from 'framer-motion';

interface Badge {
  id: string;
  name: string;
  desc: string;
  check: () => boolean;
  icon: (color: string, unlocked: boolean) => React.ReactNode;
}

function svgProps(unlocked: boolean) {
  return {
    width: 48, height: 48, viewBox: '0 0 48 48',
    fill: 'none',
    stroke: unlocked ? 'currentColor' : 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

const BADGES: Badge[] = [
  {
    id: 'first-step',
    name: 'Första steget',
    desc: 'Slutför ditt första uppdrag',
    check: () => (S.chars[S.me!]?.questsDone || 0) >= 1,
    icon: (c, u) => (
      <svg {...svgProps(u)} style={{ color: c }}>
        <path d="M18 36c0-2 2-4 6-4s6 2 6 4" />
        <path d="M20 28c0 0-1-6 4-12" />
        <circle cx="24" cy="14" r="3" />
      </svg>
    ),
  },
  {
    id: 'byggherre',
    name: 'Byggherre',
    desc: '10 Builder-uppdrag avklarade',
    check: () => {
      const me = S.me!;
      return (S.quests || []).filter((q: any) => q.done && q.cat === 'tech' && q.owner === me).length >= 10;
    },
    icon: (c, u) => (
      <svg {...svgProps(u)} style={{ color: c }}>
        <path d="M12 36 L24 12 L36 36" />
        <path d="M18 28 L30 28" />
      </svg>
    ),
  },
  {
    id: 'sandare',
    name: 'Sändare',
    desc: '10 sociala uppdrag',
    check: () => {
      const me = S.me!;
      return (S.quests || []).filter((q: any) => q.done && (q.cat === 'social' || q.cat === 'global') && q.owner === me).length >= 10;
    },
    icon: (c, u) => (
      <svg {...svgProps(u)} style={{ color: c }}>
        <path d="M24 24 m-4 0 a4 4 0 1 1 8 0 a4 4 0 1 1 -8 0" />
        <path d="M24 24 m-10 0 a10 10 0 1 1 20 0" fill="none" />
        <path d="M24 24 m-16 0 a16 16 0 1 1 32 0" fill="none" />
      </svg>
    ),
  },
  {
    id: 'mojliggoraren',
    name: 'Möjliggöraren',
    desc: '5 synergy-triggers',
    check: () => (S.feed || []).filter((f: any) => f.type === 'synergy').length >= 5,
    icon: (c, u) => (
      <svg {...svgProps(u)} style={{ color: c }}>
        <path d="M8 32 Q24 12 40 32" />
        <path d="M16 34 L16 28" />
        <path d="M32 34 L32 28" />
      </svg>
    ),
  },
  {
    id: 'reflektoren',
    name: 'Reflektören',
    desc: '20 reflektioner inskickade',
    check: () => (S.chars[S.me!]?.questsDone || 0) >= 20,
    icon: (c, u) => (
      <svg {...svgProps(u)} style={{ color: c }}>
        <ellipse cx="24" cy="24" rx="10" ry="7" />
        <circle cx="24" cy="24" r="3" />
      </svg>
    ),
  },
  {
    id: 'streakaren',
    name: 'Streakaren',
    desc: '7 dagars streak',
    check: () => (S.chars[S.me!]?.streak || 0) >= 7,
    icon: (c, u) => (
      <svg {...svgProps(u)} style={{ color: c }}>
        <path d="M24 6 L28 18 L24 14 L20 18 Z" />
        <path d="M18 18 Q24 42 30 18" />
      </svg>
    ),
  },
  {
    id: 'mangsysslaren',
    name: 'Mångsysslaren',
    desc: 'Uppdrag i alla 6 kategorier',
    check: () => {
      const cats = new Set((S.quests || []).filter((q: any) => q.done && q.owner === S.me).map((q: any) => q.cat));
      return cats.size >= 6;
    },
    icon: (c, u) => (
      <svg {...svgProps(u)} style={{ color: c }}>
        {[0, 1, 2, 3, 4, 5].map(i => {
          const angle = (i * 60 - 90) * (Math.PI / 180);
          const cx = 24 + Math.cos(angle) * 12;
          const cy = 24 + Math.sin(angle) * 12;
          return <circle key={i} cx={cx} cy={cy} r={3} />;
        })}
      </svg>
    ),
  },
  {
    id: 'bandets-hjarta',
    name: 'Bandets hjärta',
    desc: 'Acceptera 3 delegerade uppdrag',
    check: () => {
      return (S.quests || []).filter((q: any) => q.delegatedTo === S.me && q.delegationHandled).length >= 3;
    },
    icon: (c, u) => (
      <svg {...svgProps(u)} style={{ color: c }}>
        <path d="M24 38 L12 26 C8 20 12 12 20 14 L24 18 L28 14 C36 12 40 20 36 26 Z" />
      </svg>
    ),
  },
  {
    id: 'initiativtagaren',
    name: 'Initiativtagaren',
    desc: '3 retroaktiva sidequests',
    check: () => {
      return (S.quests || []).filter((q: any) => q.done && q.type === 'sidequest' && q.owner === S.me).length >= 3;
    },
    icon: (c, u) => (
      <svg {...svgProps(u)} style={{ color: c }}>
        <line x1="24" y1="8" x2="24" y2="20" />
        <line x1="18" y1="12" x2="24" y2="8" />
        <line x1="30" y1="12" x2="24" y2="8" />
        <circle cx="24" cy="28" r="8" />
      </svg>
    ),
  },
  {
    id: 'sasongsmastaren',
    name: 'Säsongsmästaren',
    desc: 'Högst XP vid säsongens slut',
    check: () => {
      if (!S.me) return false;
      const myXp = S.chars[S.me]?.totalXp || 0;
      return Object.entries(S.chars).every(([id, c]) => id === S.me || (c.totalXp || 0) <= myXp) && myXp > 0;
    },
    icon: (c, u) => (
      <svg {...svgProps(u)} style={{ color: c }}>
        <path d="M16 18 L12 10 L18 14 L24 8 L30 14 L36 10 L32 18" />
        <rect x="16" y="18" width="16" height="14" rx="2" />
        <path d="M20 38 L28 38" />
        <path d="M22 32 L22 38" />
        <path d="M26 32 L26 38" />
      </svg>
    ),
  },
];

export default function TrophyRoom() {
  const me = S.me || '';
  const member = MEMBERS[me];
  const xpColor = member?.xpColor || 'var(--color-accent)';
  const unlocked = BADGES.filter(b => b.check());
  const total = BADGES.length;

  return (
    <div className="tr-view">
      <div className="tr-header">
        <span className="tr-count">{unlocked.length} av {total} upplåsta</span>
        <div className="tr-progress-track">
          <div
            className="tr-progress-fill"
            style={{ width: `${(unlocked.length / total) * 100}%`, background: xpColor }}
          />
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        padding: '0 16px',
      }}>
        {BADGES.map((badge, i) => {
          const isUnlocked = badge.check();
          return (
            <motion.div
              key={badge.id}
              className={`tr-badge-card ${isUnlocked ? 'unlocked' : 'locked'}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              style={isUnlocked ? {
                borderColor: `${xpColor}4D`,
                '--tr-glow': xpColor,
              } as React.CSSProperties : undefined}
            >
              {!isUnlocked && (
                <div className="tr-lock-icon">
                  <Lock size={14} strokeWidth={2} />
                </div>
              )}
              <div className={`tr-badge-icon ${isUnlocked ? '' : 'grayscale'}`}>
                {isUnlocked && <div className="tr-badge-glow" style={{ background: `radial-gradient(circle, ${xpColor}26 0%, transparent 70%)` }} />}
                {badge.icon(isUnlocked ? xpColor : 'var(--color-text-muted)', isUnlocked)}
              </div>
              <span className="tr-badge-name">{badge.name}</span>
              <span className="tr-badge-desc">{badge.desc}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
