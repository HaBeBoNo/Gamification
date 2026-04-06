import React from 'react';
import { S, SEASON_START_DATE } from '@/state/store';
import { MEMBERS, MEMBER_IDS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const MILESTONES = [
  { name: 'Säsongsstart', date: new Date('2026-03-01'), reached: true },
  { name: 'Första rep', date: new Date('2026-03-15'), reached: true },
  { name: 'Album II release', date: new Date('2026-03-01'), reached: true },
  { name: 'EP-demo', date: new Date('2026-05-01'), reached: false },
  { name: 'Truminspelning', date: new Date('2026-07-01'), reached: false },
];

function generateXPCurve(): { week: number; xp: number }[] {
  const now = new Date();
  const weeksSinceStart = Math.max(1, Math.floor((now.getTime() - SEASON_START_DATE.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const data: { week: number; xp: number }[] = [];
  let cumulative = 0;
  for (let w = 1; w <= weeksSinceStart; w++) {
    const base = 100 + Math.floor(Math.random() * 80);
    const growth = Math.floor(w * 15);
    cumulative += base + growth;
    data.push({ week: w, xp: cumulative });
  }
  return data;
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

const MEDAL_COLORS = ['hsl(45, 93%, 50%)', 'hsl(0, 0%, 72%)', 'hsl(30, 60%, 45%)'];
const PODIUM_H = [80, 60, 48];

export default function SeasonView() {
  const daysActive = daysSince(SEASON_START_DATE);
  const curveData = React.useMemo(generateXPCurve, []);

  const sorted = Object.entries(S.chars)
    .map(([id, char]) => ({ id, char, member: MEMBERS[id] }))
    .filter(x => x.member)
    .sort((a, b) => (b.char.totalXp || 0) - (a.char.totalXp || 0));

  const top3 = sorted.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  const now = new Date();

  return (
    <div className="sv-view">
      <motion.div
        className="sv-header"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <div className="sv-season-name">Säsong 1</div>
          <div className="sv-season-date">{SEASON_START_DATE.toLocaleDateString('sv-SE')}</div>
        </div>
        <div className="sv-days-active">
          <span className="sv-days-num">{daysActive}</span>
          <span className="sv-days-label">dagar</span>
        </div>
      </motion.div>

      {/* Timeline */}
      <motion.div
        className="sv-timeline"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="sv-timeline-line" />
        {MILESTONES.map((m, i) => {
          const isPast = m.date <= now;
          return (
            <div key={i} className={`sv-milestone ${isPast ? 'reached' : ''}`}>
              <div className={`sv-milestone-dot ${isPast ? 'reached' : ''}`} />
              <div className="sv-milestone-content">
                <span className="sv-milestone-name">{m.name}</span>
                <span className="sv-milestone-date">{m.date.toLocaleDateString('sv-SE')}</span>
              </div>
            </div>
          );
        })}
        <div className="sv-milestone today">
          <div className="sv-today-dot" />
          <div className="sv-milestone-content">
            <span className="sv-milestone-name sv-today-label">Idag</span>
          </div>
        </div>
      </motion.div>

      {/* XP Curve */}
      <motion.div
        className="sv-chart-wrap"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={curveData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(38, 66%, 47%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(38, 66%, 47%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="week"
              tick={{ fill: 'hsla(0,0%,100%,0.35)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'hsla(0,0%,100%,0.35)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(240, 5%, 10%)',
                border: 'none',
                borderRadius: 8,
                fontFamily: 'JetBrains Mono',
                fontSize: 13,
                color: 'hsl(45, 80%, 55%)',
              }}
              labelFormatter={(w) => `Vecka ${w}`}
              formatter={(val) => [`${val} XP`, 'Total']}
            />
            <Area
              type="monotone"
              dataKey="xp"
              stroke="hsl(38, 66%, 47%)"
              strokeWidth={2}
              fill="url(#xpGrad)"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Podium */}
      <motion.div
        className="sv-podium"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {podiumOrder.map((entry, i) => {
          if (!entry) return null;
          const rank = i === 1 ? 0 : i === 0 ? 1 : 2; // center=1st, left=2nd, right=3rd
          return (
            <div key={entry.id} className="sv-podium-slot">
              <div className="sv-podium-avatar">
                <MemberIcon id={entry.id} size={32} color={entry.member!.xpColor} />
              </div>
              <span className="sv-podium-name">{entry.member!.name}</span>
              <span className="sv-podium-xp">{entry.char.totalXp || 0} XP</span>
              <div
                className="sv-podium-block"
                style={{
                  height: PODIUM_H[rank],
                  borderTopColor: MEDAL_COLORS[rank],
                }}
              />
            </div>
          );
        })}
      </motion.div>

      {/* Full rankings */}
      <motion.div
        className="sv-rankings"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {sorted.map(({ id, char, member }, i) => (
          <div
            key={id}
            className={`sv-rank-row ${id === S.me ? 'is-me' : ''}`}
            style={id === S.me ? { borderLeftColor: member!.xpColor } : undefined}
          >
            <span className="sv-rank-num">{i + 1}</span>
            <MemberIcon id={id} size={24} color={member!.xpColor} />
            <span className="sv-rank-name">{member!.name}</span>
            <span className="sv-rank-xp">{char.totalXp || 0} XP</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
