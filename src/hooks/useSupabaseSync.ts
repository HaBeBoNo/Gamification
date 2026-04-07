import { supabase } from '@/lib/supabase';
import { S, save, useGameStore } from '@/state/store';
import { clearRuntimeIssue, setRuntimeIssue } from '@/lib/runtimeHealth';
import { fetchRemoteNotifications } from '@/lib/socialData';
import { upsertNotifications } from '@/state/notifications';

export async function syncToSupabase(memberKey: string): Promise<void> {
  if (!supabase || !memberKey) return;

  const data = {
    chars: { [memberKey]: S.chars[memberKey] }, // Bara inloggad members char — övriga hämtas lazily
    quests: S.quests,
    metrics: S.metrics,
    prev: S.prev,
    checkIns: S.checkIns,
    onboarded: S.onboarded,
    operationName: S.operationName,
    weeklyCheckouts: S.weeklyCheckouts,
    notifications: useGameStore.getState().notifications.filter((notification) => notification.source !== 'supabase'),
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
    setRuntimeIssue('sync', 'HQ kunde inte spara till servern just nu. Dina andringar finns kvar lokalt.', 'warn');
    throw error;
  }

  clearRuntimeIssue('sync');
}

// Minimala fält som behövs för leaderboard
const LEADERBOARD_FIELDS = ['xp', 'level', 'streak', 'totalXp', 'questsDone'] as const;

let isSyncing = false
let syncTimeout: ReturnType<typeof setTimeout> | null = null

export async function syncFromSupabase(memberKey: string, onComplete?: () => void): Promise<void> {
  if (isSyncing) {
    onComplete?.()
    return
  }

  isSyncing = true

  // Säkerhets-timeout — återställer guard efter 10s oavsett vad
  syncTimeout = setTimeout(() => {
    console.warn('[Sync] Safety timeout triggered — resetting isSyncing')
    isSyncing = false
  }, 10000)

  // AbortController — avbryter hängande fetch-anrop efter 8s
  const controller = new AbortController()
  const abortTimer = setTimeout(() => {
    console.warn('[Sync] Aborting stuck sync after 8s')
    controller.abort()
  }, 8000)

  try {
  if (!supabase || !memberKey) return;

  // Hämta full data för inloggad member
  const { data: myRow, error: myError } = await supabase
    .from('member_data')
    .select('data')
    .eq('member_key', memberKey)
    .single()
    .abortSignal(controller.signal);

  if (myError || !myRow?.data) return;

  // Hämta full data för övriga members (diagnostik)
  const { data: othersData, error: othersError } = await supabase
    .from('member_data')
    .select('member_key, data')
    .neq('member_key', memberKey)
    .abortSignal(controller.signal);

  // Applicera full data för inloggad member
  const remote = myRow.data as any;
  S.me = memberKey;
  if (remote.onboarded !== undefined) {
    S.onboarded = remote.onboarded
    save() // ← tvinga Zustand-uppdatering direkt
  }
  // Återställ onboarded-status från chars om den finns där
  if (remote.chars?.[memberKey]?.onboarded === true) {
    S.onboarded = true
    save() // ← tvinga Zustand-uppdatering direkt
  }
  if (remote.chars) Object.assign(S.chars, remote.chars);
  if (remote.quests?.length) S.quests = remote.quests;
  if (remote.operationName) S.operationName = remote.operationName;
  if (remote.weeklyCheckouts) S.weeklyCheckouts = remote.weeklyCheckouts;
  if (remote.metrics) S.metrics = remote.metrics;
  if (remote.prev) S.prev = remote.prev;
  if (remote.checkIns) S.checkIns = remote.checkIns;
  const remoteNotifications = await fetchRemoteNotifications(memberKey);
  if (remoteNotifications.supported) {
    upsertNotifications(remoteNotifications.notifications);
  } else if (remote.notifications) {
    useGameStore.setState({ notifications: remote.notifications });
  }
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
  clearRuntimeIssue('sync');
  } catch (err) {
    setRuntimeIssue('sync', 'HQ kunde inte lasa serverdata just nu. Lokal data visas tills vidare.', 'warn');
    console.error('[Sync] Error or abort:', err)
  } finally {
    clearTimeout(abortTimer)
    if (syncTimeout) {
      clearTimeout(syncTimeout)
      syncTimeout = null
    }
    isSyncing = false
    onComplete?.()
  }
}
