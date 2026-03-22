import { supabase } from '@/lib/supabase';
import { S } from '@/state/store';

export async function syncToSupabase(memberKey: string): Promise<void> {
  if (!supabase || !memberKey) return;

  const data = {
    chars: S.chars,
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

export async function syncFromSupabase(memberKey: string): Promise<void> {
  if (!supabase || !memberKey) return;

  const { data, error } = await supabase
    .from('member_data')
    .select('data')
    .eq('member_key', memberKey)
    .single();

  if (error || !data?.data) return;

  // Sätt kritiska fält explicit
  const remote = data.data as any;
  S.me = memberKey;
  if (remote.onboarded !== undefined) S.onboarded = remote.onboarded;
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

  // Spara till localStorage omedelbart
  localStorage.setItem('sek-v6', JSON.stringify({
    me: S.me,
    onboarded: S.onboarded,
    chars: S.chars,
    quests: S.quests,
    feed: S.feed,
    metrics: S.metrics,
    prev: S.prev,
    checkIns: S.checkIns,
    operationName: S.operationName,
    weeklyCheckouts: S.weeklyCheckouts,
    notifications: S.notifications,
    seasonStart: S.seasonStart,
    seasonEnd: S.seasonEnd,
  }));
}