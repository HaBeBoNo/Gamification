import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  // Hitta members som inte haft aktivitet de senaste 5 dagarna
  const { data: inactive } = await supabase
    .from('activity_feed')
    .select('member_key')
    .lt('created_at', fiveDaysAgo)

  // Hämta unika inaktiva member_keys
  const inactiveKeys = [...new Set((inactive ?? []).map(r => r.member_key))]

  // Hämta aktiva members (haft aktivitet de senaste 5 dagarna)
  const { data: active } = await supabase
    .from('activity_feed')
    .select('member_key')
    .gte('created_at', fiveDaysAgo)

  const activeKeys = new Set((active ?? []).map(r => r.member_key))
  const targets = inactiveKeys.filter(k => !activeKeys.has(k))

  // Hämta push-subscriptions för inaktiva members
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('member_key', targets)

  const results = await Promise.allSettled(
    (subs ?? []).map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: 'Du saknas i HQ 👋',
          body: 'Det har gått 5 dagar. Bandet räknar med dig.',
          url: '/',
        })
      )
    )
  )

  return new Response(
    JSON.stringify({ notified: results.filter(r => r.status === 'fulfilled').length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
