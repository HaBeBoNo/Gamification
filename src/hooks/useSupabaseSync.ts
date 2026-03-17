import { supabase } from '@/lib/supabase';
import { S } from '@/state/store';

export async function syncToSupabase(memberKey: string): Promise<void> {
  if (!memberKey) return;

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
  if (!memberKey) return;

  const { data, error } = await supabase
    .from('member_data')
    .select('data')
    .eq('member_key', memberKey)
    .single();

  if (error || !data?.data) return;

  // Mergea in i S
  const remote = data.data as any;
  if (remote.chars) Object.assign(S.chars, remote.chars);
  if (remote.quests) S.quests = remote.quests;
  if (remote.feed) S.feed = remote.feed;
  if (remote.metrics) S.metrics = remote.metrics;
  if (remote.prev) S.prev = remote.prev;
  if (remote.checkIns) S.checkIns = remote.checkIns;
  if (remote.onboarded) S.onboarded = remote.onboarded;
  if (remote.operationName) S.operationName = remote.operationName;
  if (remote.weeklyCheckouts) S.weeklyCheckouts = remote.weeklyCheckouts;
  S.me = memberKey;

  // Spara lokalt för offline-support
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
  }));
}
