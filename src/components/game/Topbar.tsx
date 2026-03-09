import React from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { Shield, Flame, Star } from 'lucide-react';
import { MemberIcon } from '@/components/icons/MemberIcons';
import NotificationBell from './NotificationBell';
import MemberStatusDot from './MemberStatusDot';

interface TopbarProps {
  rerender: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAdmin: () => void;
  logoRef?: (node: HTMLDivElement | null) => void;
  onNotifications?: () => void;
}

export default function Topbar({ rerender, activeTab, setActiveTab, onAdmin, logoRef, onNotifications }: TopbarProps) {
  const me = S.me;
  const member = me ? MEMBERS[me] : null;
  const char = me ? S.chars[me] : null;

  return (
    <div className="topbar">
      <div className="topbar-logo" ref={logoRef}>
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
        >QUESTS</button>
        <button
          className={`nav-pill ${activeTab === 'skilltree' ? 'active' : ''}`}
          onClick={() => setActiveTab('skilltree')}
        >SKILLTREE</button>
        <button
          className={`nav-pill ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >LEADERBOARD</button>
      </nav>
      {char && char.streak > 0 && (
        <div className={`topbar-streak streak-tier-${char.streak >= 14 ? 'max' : char.streak >= 7 ? 'high' : char.streak >= 3 ? 'mid' : 'low'}`}>
          <Flame size={16} />
          <span className="topbar-streak-num">{char.streak}</span>
          <span className="topbar-streak-label">dagar</span>
        </div>
      )}
      {onNotifications && <NotificationBell onClick={onNotifications} />}
      {me === 'hannes' && (
        <button className="topbar-admin-btn" onClick={onAdmin}>
          <Shield size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
          ADMIN
        </button>
      )}
      {member && (
        <div className="topbar-player">
          <span className="topbar-player-avatar" style={{ position: 'relative' }}>
            <MemberIcon id={S.me!} size={20} />
            <MemberStatusDot memberId={S.me!} size={20} />
          </span>
          <span className="topbar-player-name">
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{member.name}</span>
            <span className="topbar-player-meta">
              <Star size={14} className="topbar-level-star" />
              <span className="topbar-level-num">{char?.level || 1}</span>
              <span> · {member.role}</span>
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
