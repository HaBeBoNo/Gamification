import React from 'react';
import { S, save } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { Shield } from 'lucide-react';
import { MemberIcon } from '@/components/icons/MemberIcons';

interface TopbarProps {
  rerender: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAdmin: () => void;
}

export default function Topbar({ rerender, activeTab, setActiveTab, onAdmin }: TopbarProps) {
  const me = S.me;
  const member = me ? MEMBERS[me] : null;
  const char = me ? S.chars[me] : null;

  return (
    <div className="topbar">
      <div className="topbar-logo">
        SEKTIONEN <span>HEADQUARTERS</span>
      </div>
      <div className="topbar-op">
        <div className="topbar-op-name">{S.operationName}</div>
        <div className="topbar-week">VECKA {S.weekNum}</div>
      </div>
      <nav className="topbar-nav">
        <button
          className={`nav-pill ${activeTab === 'quests' ? 'active' : ''}`}
          onClick={() => setActiveTab('quests')}
        >UPPDRAG</button>
        <button
          className={`nav-pill ${activeTab === 'scoreboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('scoreboard')}
        >SCOREBOARD</button>
      </nav>
      {char && char.streak > 0 && (
        <div className="topbar-streak">🔥 {char.streak} dagar</div>
      )}
      {me === 'hannes' && (
        <button className="topbar-admin-btn" onClick={onAdmin}>
          <Shield size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
          ADMIN
        </button>
      )}
      {member && (
        <div className="topbar-player">
          <span className="topbar-player-avatar"><MemberIcon id={S.me!} size={20} /></span>
          <span className="topbar-player-name">
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{member.name}</span>
            <span style={{ fontSize: 'var(--text-micro)', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Lv {char?.level || 1} · {member.role}</span>
          </span>
        </div>
      )}
    </div>
  );
}
