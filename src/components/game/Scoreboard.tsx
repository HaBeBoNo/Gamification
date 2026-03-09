import React from 'react';
import { S } from '@/state/store';
import { MEMBERS, ROLE_TYPE_LABEL } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';

const GOALS = [
  { key: 'spf', label: 'Spotify Followers', target: 1000, icon: '🎵' },
  { key: 'str', label: 'Månadsstreams', target: 100000, icon: '▶️' },
  { key: 'ig', label: 'Instagram', target: 500, icon: '📷' },
  { key: 'tix', label: 'Japan-biljetter', target: 100, icon: '🎟️' },
];

export default function Scoreboard() {
  const sorted = Object.entries(S.chars)
    .map(([id, char]) => ({ id, char, member: MEMBERS[id] }))
    .filter(x => x.member)
    .sort((a, b) => {
      const totalA = (a.char.pts?.work || 0) + (a.char.pts?.spotify || 0) + (a.char.pts?.social || 0) + (a.char.pts?.bonus || 0);
      const totalB = (b.char.pts?.work || 0) + (b.char.pts?.spotify || 0) + (b.char.pts?.social || 0) + (b.char.pts?.bonus || 0);
      return totalB - totalA;
    });

  const bandTotalXP = Object.values(S.chars).reduce((s, c) => s + (c.totalXp || 0), 0);
  const seasonGoal = 10000;
  const bandPct = Math.min(100, Math.round((bandTotalXP / seasonGoal) * 100));

  return (
    <div className="sb-view">
      <div className="sb-header">
        <div className="sb-title">{S.operationName}</div>
        <div className="sb-subtitle">Vecka {S.weekNum} · Säsong 1</div>
        <div className="sb-band-bar">
          <div className="sb-band-label">
            <span>BAND XP</span>
            <span>{bandTotalXP} / {seasonGoal}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: bandPct + '%' }} />
          </div>
        </div>
      </div>

      <div className="sb-table">
        <div className="sb-table-head">
          <div className="sb-th">#</div>
          <div className="sb-th">SPELARE</div>
          <div className="sb-th" style={{ textAlign: 'right' }}>ARBETE</div>
          <div className="sb-th" style={{ textAlign: 'right' }}>SPOTIFY</div>
          <div className="sb-th" style={{ textAlign: 'right' }}>SOCIALT</div>
          <div className="sb-th" style={{ textAlign: 'right' }}>BONUS</div>
          <div className="sb-th" style={{ textAlign: 'right' }}>TOTALT</div>
        </div>
        {sorted.map(({ id, char, member }, i) => {
          const total = (char.pts?.work || 0) + (char.pts?.spotify || 0) + (char.pts?.social || 0) + (char.pts?.bonus || 0);
          const rt = char.roleType || member!.roleType || 'amplifier';
          const roleInfo = ROLE_TYPE_LABEL[rt];
          return (
            <div key={id} className="sb-row">
              <div className="sb-rank">{i + 1}</div>
              <div className="sb-member">
                <span className="sb-member-emoji"><MemberIcon id={id} size={20} /></span>
                <div>
                  <div className="sb-member-name">{member!.name}</div>
                  <div className="sb-member-role">{member!.role}</div>
                  {roleInfo && (
                    <span className="lb-role-badge" style={{ color: roleInfo.color, borderColor: roleInfo.color + '40', fontSize: '0.55rem' }}>
                      {roleInfo.label}
                    </span>
                  )}
                </div>
              </div>
              <div className="sb-pts">{char.pts?.work || 0}</div>
              <div className="sb-pts">{char.pts?.spotify || 0}</div>
              <div className="sb-pts">{char.pts?.social || 0}</div>
              <div className="sb-pts">{char.pts?.bonus || 0}</div>
              <div className="sb-total">{total}</div>
            </div>
          );
        })}
      </div>

      <div className="sb-goals">
        {GOALS.map(g => {
          const val = S.metrics?.[g.key] || 0;
          const pct = Math.min(100, Math.round((val / g.target) * 100));
          return (
            <div key={g.key} className="sb-goal">
              <div className="sb-goal-title">{g.icon} {g.label}</div>
              <div className="sb-goal-val">{val.toLocaleString('sv-SE')}</div>
              <div className="sb-goal-target">Mål: {g.target.toLocaleString('sv-SE')}</div>
              <div className="progress-track" style={{ marginTop: 6 }}>
                <div className="progress-fill" style={{ width: pct + '%' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
