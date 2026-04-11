type BandActivityFeedRow = {
  who?: string | null;
  created_at?: string | null;
  xp?: number | null;
};

type BandPresenceRow = {
  member_key?: string | null;
  last_seen_at?: string | null;
};

type SummarizeBandActivityParams = {
  recentFeedRows: BandActivityFeedRow[];
  todayFeedRows: BandActivityFeedRow[];
  todayPresenceRows: BandPresenceRow[];
  activeNow: number | null;
  localMemberIsLive: boolean;
};

function hasValidTimestamp(value?: string | null): boolean {
  return Boolean(value) && !Number.isNaN(Date.parse(String(value)));
}

export function summarizeBandActivitySnapshot({
  recentFeedRows,
  todayFeedRows,
  todayPresenceRows,
  activeNow,
  localMemberIsLive,
}: SummarizeBandActivityParams): { activeToday: number; xp48h: number; activeNow: number | null } {
  const activeTodayMembers = new Set<string>();

  for (const row of todayFeedRows || []) {
    const who = String(row?.who || '');
    if (who) activeTodayMembers.add(who);
  }

  for (const row of todayPresenceRows || []) {
    const memberKey = String(row?.member_key || '');
    if (!memberKey || !hasValidTimestamp(row?.last_seen_at)) continue;
    activeTodayMembers.add(memberKey);
  }

  let xp48h = 0;
  for (const row of recentFeedRows || []) {
    xp48h += Number(row?.xp || 0);
  }

  const baseActiveNow = typeof activeNow === 'number' ? activeNow : null;
  return {
    activeToday: localMemberIsLive ? Math.max(activeTodayMembers.size, 1) : activeTodayMembers.size,
    xp48h,
    activeNow: baseActiveNow === null
      ? (localMemberIsLive ? 1 : null)
      : Math.max(baseActiveNow, localMemberIsLive ? 1 : 0),
  };
}
