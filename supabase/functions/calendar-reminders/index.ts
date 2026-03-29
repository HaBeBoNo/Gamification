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

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Hämta alla push-subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')

  // Hämta alla reminders från member_data
  const { data: members } = await supabase
    .from('member_data')
    .select('member_key, data')

  let sent = 0

  for (const member of members ?? []) {
    const reminders = member.data?.reminders ?? []
    const tomorrowReminders = reminders.filter((r: any) =>
      r.eventStart?.startsWith(tomorrowStr)
    )

    if (tomorrowReminders.length === 0) continue

    const memberSubs = (subs ?? []).filter(
      (s: any) => s.member_key === member.member_key
    )

    for (const reminder of tomorrowReminders) {
      for (const sub of memberSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: '📅 Imorgon',
              body: reminder.eventTitle,
              url: '/',
            })
          )
          sent++
        } catch (e) {
          console.error('Push failed:', e)
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
