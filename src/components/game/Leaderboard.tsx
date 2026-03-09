import React from 'react';
import { S } from '@/state/store';
import { MEMBERS, ROLE_TYPE_LABEL } from '@/data/members';
import { Trophy } from 'lucide-react';
import { MemberIcon } from '@/components/icons/MemberIcons';

export default function Leaderboard() {
  const sorted = Object.entries(S.chars)
    .map(([id, char]) => ({ id, char, member: MEMBERS[id] }))
    .filter(x => x.member)
    .sort((a, b) => (b.char.totalXp || 0) - (a.char.totalXp || 0));

  function rankClass(i: number) {
    if (i === 0) return 'lb-rank top1';
    if (i === 1) return 'lb-rank top2';
    if (i === 2) return 'lb-rank top3';
    return 'lb-rank';
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <Trophy size={14} strokeWidth={2} />
          LEADERBOARD
        </div>
      </div>
      {sorted.length === 0 ? (
        <div className="empty-state">
          <Trophy size={28} strokeWidth={1} style={{ opacity: 0.25 }} />
          <div className="empty-text">Ingen data ännu. Slutför ett uppdrag!</div>
        </div>
      ) : (
        <div className="lb-list">
          {sorted.map(({ id, char, member }, i) => {
            const rt = char.roleType || member!.roleType || 'amplifier';
            const roleLabel = ROLE_TYPE_LABEL[rt];
            const pct = char.xpToNext > 0
              ? Math.min(100, Math.round((char.xp / char.xpToNext) * 100))
              : 100;
            return (
              <div key={id} className="lb-row">
                <div className={rankClass(i)}>{i + 1}</div>
                <div className="lb-avatar"><MemberIcon id={id} size={20} /></div>
                <div className="lb-info">
                  <div className="lb-name">{member!.name}</div>
                  <div className="lb-role">{member!.role}</div>
                  {roleLabel && (
                    <span className="lb-role-badge" style={{ color: roleLabel.color, borderColor: roleLabel.color + '18' }}>
                      {roleLabel.label}
                    </span>
                  )}
                  <div className="xp-bar" style={{ marginTop: 6 }}>
                    <div className="xp-fill" style={{ width: pct + '%', background: member!.xpColor }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="lb-xp">{char.totalXp || 0}</div>
                  <div className="lb-level">Lv {char.level || 1}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
