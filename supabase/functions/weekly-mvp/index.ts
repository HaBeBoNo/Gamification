import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async () => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: feed } = await supabase
    .from('activity_feed')
    .select('who, xp, action')
    .gte('created_at', since);

  if (!feed || feed.length === 0) {
    return new Response('No activity', { status: 200 });
  }

  // Count XP per member
  const xpMap: Record<string, number> = {};
  for (const item of feed) {
    if (!item.who) continue;
    xpMap[item.who] = (xpMap[item.who] ?? 0) + (item.xp ?? 0);
  }

  const topMember = Object.entries(xpMap).sort((a, b) => b[1] - a[1])[0];
  if (!topMember) return new Response('No data', { status: 200 });

  const [mvpKey, mvpXP] = topMember;
  const totalXP = Object.values(xpMap).reduce((s, v) => s + v, 0);
  const activeCount = Object.keys(xpMap).length;

  // Post summary in activity_feed
  await supabase.from('activity_feed').insert({
    who: 'system',
    action: `Veckans sammanfattning: ${activeCount} members aktiva, ${totalXP} XP totalt. MVP: ${mvpKey} med ${mvpXP} XP 🏆`,
    xp: 0,
    created_at: new Date().toISOString(),
  });

  // Set mvp_badge on winner, clear others
  const { data: allMembers } = await supabase.from('member_data').select('member_key, data');
  for (const m of allMembers ?? []) {
    const memberData = m.data ?? {};
    const updatedData = {
      ...memberData,
      mvp_badge: m.member_key === mvpKey,
    };
    await supabase
      .from('member_data')
      .update({ data: updatedData })
      .eq('member_key', m.member_key);
  }

  return new Response(JSON.stringify({ mvp: mvpKey, xp: mvpXP }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
