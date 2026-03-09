import React, { useState, useEffect } from 'react';
import { S } from '@/state/store';
import { MEMBERS, MEMBER_IDS } from '@/data/members';

const MILESTONES = [
  { pct: 25, label: 'Första rep' },
  { pct: 50, label: 'EP-demo' },
  { pct: 75, label: 'Spelning' },
];

const GOAL_TITLE = 'Bandresa 2026';
const GOAL_TARGET = 10000;

export default function CommunityGoal() {
  const [animPct, setAnimPct] = useState(0);
  const totalXP = Object.values(S.chars).reduce((s, c) => s + (c.totalXp || 0), 0);
  const pct = Math.min(100, Math.round((totalXP / GOAL_TARGET) * 100));

  useEffect(() => {
    const t = setTimeout(() => setAnimPct(pct), 50);
    return () => clearTimeout(t);
  }, [pct]);

  const [tooltip, setTooltip] = useState<string | null>(null);

  return (
    <div className="cg-card">
      <div className="cg-top-row">
        <span className="cg-title">{GOAL_TITLE}</span>
        <span className="cg-target">{GOAL_TARGET.toLocaleString('sv-SE')} XP</span>
      </div>

      <div className="cg-bar-wrap">
        <div className="cg-bar-track">
          <div
            className={`cg-bar-fill ${animPct >= 100 ? 'complete' : ''}`}
            style={{ width: `${animPct}%`, transition: 'width 800ms ease-out' }}
          />
          {MILESTONES.map(m => (
            <div key={m.pct} className="cg-milestone" style={{ left: `${m.pct}%` }}>
              <div className={`cg-milestone-dot ${pct >= m.pct ? 'reached' : ''}`} />
              <span className="cg-milestone-label">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="cg-stats-row">
        <span className="cg-current">{totalXP.toLocaleString('sv-SE')}</span>
        <span className="cg-pct">{pct}% avklarat</span>
      </div>

      <div className="cg-members-row">
        {MEMBER_IDS.map(id => {
          const m = MEMBERS[id];
          const char = S.chars[id];
          const xp = char?.totalXp || 0;
          const proportion = totalXP > 0 ? (xp / totalXP) * 100 : 0;
          const initials = m.name.charAt(0).toUpperCase();
          return (
            <div
              key={id}
              className="cg-member"
              onMouseEnter={() => setTooltip(id)}
              onMouseLeave={() => setTooltip(null)}
              onTouchStart={() => setTooltip(id)}
              onTouchEnd={() => setTooltip(null)}
            >
              <div className="cg-member-avatar" style={{ background: m.xpColor }}>
                {initials}
              </div>
              <div className="cg-member-bar">
                <div
                  className="cg-member-bar-fill"
                  style={{ width: `${Math.max(10, proportion)}%`, background: m.xpColor }}
                />
              </div>
              {tooltip === id && (
                <div className="cg-member-tooltip">
                  <span>{m.name}</span>
                  <span>{xp} XP</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
