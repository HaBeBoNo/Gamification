import React from 'react';
import { S } from '../state/store';
import { MEMBERS, ROLE_TYPE_LABEL } from '../data/members';

export default function Leaderboard() {
  const sorted = Object.entries(S.chars)
    .map(([id, char]) => ({ id, char, member: MEMBERS[id] }))
    .filter(x => x.member)
    .sort((a, b) => (b.char.totalXp || 0) - (a.char.totalXp || 0));

  function rankClass(i) {
    if (i === 0) return 'lb-rank top1';
    if (i === 1) return 'lb-rank top2';
    if (i === 2) return 'lb-rank top3';
    return 'lb-rank';
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">🏆 LEADERBOARD</div>
      </div>
      <div className="lb-list">
        {sorted.map(({ id, char, member }, i) => {
          const rt = char.roleType || member.roleType || 'amplifier';
          const roleLabel = ROLE_TYPE_LABEL[rt];
          const pct = char.xpToNext > 0
            ? Math.min(100, Math.round((char.xp / char.xpToNext) * 100))
            : 100;

          return (
            <div key={id} className="lb-row">
              <div className={rankClass(i)}>{i + 1}</div>
              <div className="lb-avatar">{member.emoji}</div>
              <div className="lb-info">
                <div className="lb-name">{member.name}</div>
                <div className="lb-role">{member.role}</div>
                {roleLabel && (
                  <span
                    className="lb-role-badge"
                    style={{ color: roleLabel.color, borderColor: roleLabel.color + '40' }}
                  >
                    {roleLabel.label}
                  </span>
                )}
                <div className="xp-bar" style={{ marginTop: 4 }}>
                  <div
                    className="xp-fill"
                    style={{ width: pct + '%', background: member.xpColor || 'var(--gold)' }}
                  />
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div className="lb-xp">{char.totalXp || 0}</div>
                <div className="lb-level">Lv {char.level || 1}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
