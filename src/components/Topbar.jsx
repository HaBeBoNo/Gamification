import React from 'react';
import { S, save } from '../state/store';
import { MEMBERS } from '../data/members';

export default function Topbar({ rerender, activeTab, setActiveTab, onAdmin, onAddQuest }) {
  const me = S.me;
  const member = me ? MEMBERS[me] : null;
  const char = me ? S.chars[me] : null;

  return (
    <div className="topbar">
      <div className="topbar-logo">
        SEKTIONEN <span>WAR ROOM</span>
      </div>
      <div className="topbar-op">
        <div className="topbar-op-name">{S.operationName}</div>
        <div className="topbar-week">VECKA {S.weekNum}</div>
      </div>
      <nav className="topbar-nav">
        <button
          className={`nav-pill ${activeTab === 'quests' ? 'active' : ''}`}
          onClick={() => setActiveTab('quests')}
        >
          UPPDRAG
        </button>
        <button
          className={`nav-pill ${activeTab === 'scoreboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('scoreboard')}
        >
          SCOREBOARD
        </button>
        <button
          className={`nav-pill ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          METRICS
        </button>
        {onAddQuest && (
          <button className="nav-pill" onClick={onAddQuest}>
            +UPPDRAG
          </button>
        )}
      </nav>
      {char && char.streak > 0 && (
        <div className="topbar-streak">
          🔥 {char.streak} dagar
        </div>
      )}
      {me === 'hannes' && (
        <button className="topbar-admin-btn" onClick={onAdmin}>
          ADMIN
        </button>
      )}
      {member && (
        <div className="topbar-player">
          <span className="topbar-player-avatar">{member.emoji}</span>
          <span className="topbar-player-name">
            {member.name} · Lv{char?.level || 1}
          </span>
        </div>
      )}
    </div>
  );
}
