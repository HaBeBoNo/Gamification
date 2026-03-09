import React from 'react';
import { S } from '@/state/store';

interface Props {
  memberId: string;
  size?: number; // avatar size to determine dot size
}

export default function MemberStatusDot({ memberId, size = 24 }: Props) {
  const char = S.chars[memberId];
  if (!char) return null;

  const lastSeen = char.lastSeen || 0;
  const now = Date.now();
  const hoursSince = (now - lastSeen) / (1000 * 60 * 60);

  let dotColor: string | null = null;
  if (hoursSince <= 24) {
    dotColor = 'hsl(142, 71%, 45%)'; // green
  } else if (hoursSince <= 168) {
    dotColor = 'hsl(38, 92%, 50%)'; // amber
  }

  if (!dotColor) return null;

  const dotSize = size >= 32 ? 10 : size >= 28 ? 8 : 6;

  return (
    <span
      className="member-status-dot"
      style={{
        width: dotSize,
        height: dotSize,
        background: dotColor,
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderRadius: '50%',
        border: '2px solid var(--color-surface-elevated)',
        zIndex: 2,
      }}
    />
  );
}
