import React from 'react';
import { S } from '@/state/store';
import { MEMBERS } from '@/data/members';
import { MemberIcon } from '@/components/icons/MemberIcons';
import SkillNodes from './SkillNodes';
import TrophyRoom from './TrophyRoom';

export default function Scoreboard() {
  const me = S.me || '';
  const member = MEMBERS[me];
  const char = S.chars[me];
  const xpColor = member?.xpColor || 'var(--color-accent)';
  const level = char?.level || 1;
  const totalXp = char?.totalXp || 0;

  // Count unlocked badges
  const badges = (char as any)?.badges || [];
  const unlockedCount = badges.filter((b: any) => b.unlocked).length;

  return (
    <div className="sb-view">
      {/* Profile header */}
      <div className="sb-profile-header stagger-1">
        <div className="sb-profile-icon">
          <MemberIcon id={me} size={48} color={xpColor} />
        </div>
        <div className="sb-profile-name">{member?.name || me}</div>
        <div className="sb-profile-level">Nivå {level}</div>
        <div className="sb-profile-xp">{totalXp}</div>
      </div>

      {/* Skill Nodes */}
      <div className="stagger-2">
        <SkillNodes />
      </div>

      {/* Section divider */}
      <div className="sb-divider stagger-3">
        <span className="sb-divider-label">MÄRKEN{unlockedCount > 0 ? ` (${unlockedCount})` : ''}</span>
      </div>

      {/* Trophy Room */}
      <div className="stagger-3">
        <TrophyRoom />
      </div>
    </div>
  );
}
