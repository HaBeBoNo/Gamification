import { supabase } from '@/lib/supabase';
import { S, save } from '@/state/store';

export async function syncToSupabase(memberKey: string): Promise<void> {
  if (!supabase || !memberKey) return;

  const data = {
    chars: { [memberKey]: S.chars[memberKey] }, // Bara inloggad members char — övriga hämtas lazily
    quests: S.quests,
    feed: S.feed.slice(0, 50), // max 50 feed-items
    metrics: S.metrics,
    prev: S.prev,
    checkIns: S.checkIns,
    onboarded: S.onboarded,
    operationName: S.operationName,
    weeklyCheckouts: S.weeklyCheckouts,
    notifications: S.notifications,
    seasonStart: S.seasonStart,
    seasonEnd: S.seasonEnd,
  };

  const { error } = await supabase
    .from('member_data')
    .upsert({
      member_key: memberKey,
      data,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'member_key',
    });

  if (error) {
    console.warn('Supabase sync failed:', error.message);
  }
}

// Minimala fält som behövs för leaderboard
const LEADERBOARD_FIELDS = ['xp', 'level', 'streak', 'totalXp', 'questsDone'] as const;

let isSyncing = false
let syncTimeout: ReturnType<typeof setTimeout> | null = null

export async function syncFromSupabase(memberKey: string): Promise<void> {
  if (isSyncing) {
    console.log('[Sync] Already syncing, skipping duplicate call')
    return
  }

  isSyncing = true

  // Säkerhets-timeout — återställer guard efter 10s oavsett vad
  syncTimeout = setTimeout(() => {
    console.warn('[Sync] Safety timeout triggered — resetting isSyncing')
    isSyncing = false
  }, 10000)

  try {
  if (!supabase || !memberKey) return;

  // Hämta full data för inloggad member
  const { data: myRow, error: myError } = await supabase
    .from('member_data')
    .select('data')
    .eq('member_key', memberKey)
    .single();

  if (myError || !myRow?.data) return;

  // Hämta full data för övriga members (diagnostik)
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Sync timeout')), 5000)
  );
  const syncPromise = supabase
    .from('member_data')
    .select('member_key, data')
    .neq('member_key', memberKey);

  const { data: othersData, error: othersError } = await Promise.race([
    syncPromise,
    timeoutPromise,
  ]) as any;

  console.log('[Sync] othersData:', othersData?.length, 'othersError:', othersError);

  // Applicera full data för inloggad member
  const remote = myRow.data as any;
  S.me = memberKey;
  if (remote.onboarded !== undefined) S.onboarded = remote.onboarded;
  // Återställ onboarded-status från chars om den finns där
  if (remote.chars?.[memberKey]?.onboarded === true) {
    S.onboarded = true
  }
  if (remote.chars) Object.assign(S.chars, remote.chars);
  if (remote.quests?.length) S.quests = remote.quests;
  if (remote.feed?.length) S.feed = remote.feed;
  if (remote.operationName) S.operationName = remote.operationName;
  if (remote.weeklyCheckouts) S.weeklyCheckouts = remote.weeklyCheckouts;
  if (remote.metrics) S.metrics = remote.metrics;
  if (remote.prev) S.prev = remote.prev;
  if (remote.checkIns) S.checkIns = remote.checkIns;
  if (remote.notifications) S.notifications = remote.notifications;
  if (remote.seasonStart) S.seasonStart = remote.seasonStart;
  if (remote.seasonEnd) S.seasonEnd = remote.seasonEnd;

  // Applicera minimala leaderboard-fält för övriga members
  if (!othersError && othersData) {
    for (const row of othersData) {
      const otherKey = row.member_key as string;
      const chars = (row as any).data?.chars as Record<string, any> | null;
      if (!chars) continue;

      // chars är { [otherKey]: charData } — stöd både nytt format (1 member) och gammalt (alla 8)
      const charData = chars[otherKey] ?? Object.values(chars)[0];
      if (!charData) continue;

      if (!S.chars[otherKey]) (S.chars as any)[otherKey] = {};
      for (const field of LEADERBOARD_FIELDS) {
        if (charData[field] !== undefined) {
          (S.chars as any)[otherKey][field] = charData[field];
        }
      }
    }
  }

  // Spara explicit till localStorage via save()
  save();
  } finally {
    if (syncTimeout) {
      clearTimeout(syncTimeout)
      syncTimeout = null
    }
    isSyncing = false
  }
}