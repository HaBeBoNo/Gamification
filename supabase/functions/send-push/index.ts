import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

function isExpiredSubscriptionError(error: unknown): boolean {
  const statusCode = Number((error as { statusCode?: number })?.statusCode || 0)
  return statusCode === 404 || statusCode === 410
}

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

  const expiredSubscriptionIds: string[] = []
  const results = await Promise.all(
    (subs ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url })
        )
        return { status: 'fulfilled' as const }
      } catch (error) {
        if (isExpiredSubscriptionError(error)) {
          expiredSubscriptionIds.push(sub.id)
        } else {
          console.error('send-push failed:', error)
        }
        return { status: 'rejected' as const }
      }
    })
  )

  if (expiredSubscriptionIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredSubscriptionIds)
  }

  return new Response(JSON.stringify({
    targeted: (subs ?? []).length,
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
    removed: expiredSubscriptionIds.length,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
