import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

serve(async (req) => {
  const { title, body, url, exclude_member, target_member_keys } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  let query = supabase.from('push_subscriptions').select('*')
  if (Array.isArray(target_member_keys) && target_member_keys.length > 0) {
    query = query.in('member_key', target_member_keys)
  }
  if (exclude_member) query = query.neq('member_key', exclude_member)
  const { data: subs } = await query
  const results = await Promise.allSettled(
    (subs ?? []).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url })
      )
    )
  )
  return new Response(JSON.stringify({ sent: results.filter(r => r.status === 'fulfilled').length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
