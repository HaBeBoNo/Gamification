import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
)

type PushSubscriptionRow = {
  id: string
  member_key: string
  endpoint: string
  p256dh: string
  auth: string
}

type ReminderEntry = {
  eventId?: string
  eventTitle?: string
  eventStart?: string
  memberKey?: string
}

type CheckInEntry = {
  eventId?: string
  eventTitle?: string
  eventStart?: string
  memberKey?: string
  member?: string
  type?: string
}

type MemberRow = {
  member_key: string
  data?: {
    reminders?: ReminderEntry[]
    checkIns?: CheckInEntry[]
  } | null
}

type NotificationCandidate = {
  memberKey: string
  type: 'calendar_reminder' | 'calendar_check_in_open'
  title: string
  body: string
  dedupeKey: string
  payload: Record<string, string>
  pushTitle: string
  pushBody: string
}

function stockholmDateKey(value: string | Date): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(typeof value === 'string' ? new Date(value) : value)
}

function isFutureEvent(dateStr: string, nowMs: number): boolean {
  const eventMs = new Date(dateStr).getTime()
  return Number.isFinite(eventMs) && eventMs > nowMs
}

function isEventSoon(dateStr: string, nowMs: number): boolean {
  const eventMs = new Date(dateStr).getTime()
  if (!Number.isFinite(eventMs)) return false
  const diff = eventMs - nowMs
  return diff > 0 && diff < 24 * 60 * 60 * 1000
}

function isExpiredSubscriptionError(error: unknown): boolean {
  const statusCode = Number((error as { statusCode?: number })?.statusCode || 0)
  return statusCode === 404 || statusCode === 410
}

function ownEntry(entryMemberKey: string | undefined, fallbackMember: string | undefined, memberKey: string): boolean {
  return (entryMemberKey || fallbackMember || '') === memberKey
}

function collectCandidateNotifications(member: MemberRow, now: Date): NotificationCandidate[] {
  const nowMs = now.getTime()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = stockholmDateKey(tomorrow)

  const reminders = Array.isArray(member.data?.reminders) ? member.data?.reminders || [] : []
  const checkIns = Array.isArray(member.data?.checkIns) ? member.data?.checkIns || [] : []

  const declinedEventIds = new Set(
    checkIns
      .filter((entry) => ownEntry(entry.memberKey, entry.member, member.member_key))
      .filter((entry) => entry.type === 'decline')
      .map((entry) => String(entry.eventId || ''))
      .filter(Boolean)
  )

  const checkedInEventIds = new Set(
    checkIns
      .filter((entry) => ownEntry(entry.memberKey, entry.member, member.member_key))
      .filter((entry) => entry.type !== 'rsvp' && entry.type !== 'decline')
      .map((entry) => String(entry.eventId || ''))
      .filter(Boolean)
  )

  const trackedEvents = new Map<string, { eventId: string; eventTitle: string; eventStart: string }>()

  reminders
    .filter((entry) => ownEntry(entry.memberKey, undefined, member.member_key))
    .forEach((entry) => {
      const eventId = String(entry.eventId || '')
      const eventTitle = String(entry.eventTitle || '').trim()
      const eventStart = String(entry.eventStart || '')
      if (!eventId || !eventTitle || !eventStart) return
      trackedEvents.set(eventId, { eventId, eventTitle, eventStart })
    })

  checkIns
    .filter((entry) => ownEntry(entry.memberKey, entry.member, member.member_key))
    .filter((entry) => entry.type === 'rsvp')
    .forEach((entry) => {
      const eventId = String(entry.eventId || '')
      const eventTitle = String(entry.eventTitle || '').trim()
      const eventStart = String(entry.eventStart || '')
      if (!eventId || !eventTitle || !eventStart) return
      if (!trackedEvents.has(eventId)) {
        trackedEvents.set(eventId, { eventId, eventTitle, eventStart })
      }
    })

  const candidates: NotificationCandidate[] = []

  trackedEvents.forEach((event) => {
    if (declinedEventIds.has(event.eventId) || checkedInEventIds.has(event.eventId)) return
    if (!isFutureEvent(event.eventStart, nowMs)) return

    if (isEventSoon(event.eventStart, nowMs)) {
      candidates.push({
        memberKey: member.member_key,
        type: 'calendar_check_in_open',
        title: 'Check-in är öppen',
        body: event.eventTitle,
        dedupeKey: `calendar-check-in-open:${member.member_key}:${event.eventId}`,
        payload: {
          eventId: event.eventId,
          eventTitle: event.eventTitle,
          eventStart: event.eventStart,
        },
        pushTitle: '📍 Check-in öppen',
        pushBody: `Checka in när du är på plats för ${event.eventTitle}`,
      })
      return
    }

    if (stockholmDateKey(event.eventStart) === tomorrowKey) {
      candidates.push({
        memberKey: member.member_key,
        type: 'calendar_reminder',
        title: 'Imorgon',
        body: event.eventTitle,
        dedupeKey: `calendar-reminder:${member.member_key}:${event.eventId}`,
        payload: {
          eventId: event.eventId,
          eventTitle: event.eventTitle,
          eventStart: event.eventStart,
        },
        pushTitle: '📅 Imorgon',
        pushBody: event.eventTitle,
      })
    }
  })

  return candidates
}

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const [subsResult, membersResult] = await Promise.all([
    supabase.from('push_subscriptions').select('*'),
    supabase.from('member_data').select('member_key, data'),
  ])

  const subscriptions = (subsResult.data || []) as PushSubscriptionRow[]
  const members = (membersResult.data || []) as MemberRow[]
  const subscriptionsByMember = new Map<string, PushSubscriptionRow[]>()

  subscriptions.forEach((subscription) => {
    const current = subscriptionsByMember.get(subscription.member_key) || []
    current.push(subscription)
    subscriptionsByMember.set(subscription.member_key, current)
  })

  const now = new Date()
  const candidates = members.flatMap((member) => collectCandidateNotifications(member, now))
  const dedupeKeys = [...new Set(candidates.map((candidate) => candidate.dedupeKey))]
  const memberKeys = [...new Set(candidates.map((candidate) => candidate.memberKey))]

  const existingNotifications = new Set<string>()
  if (dedupeKeys.length > 0 && memberKeys.length > 0) {
    const { data } = await supabase
      .from('notifications')
      .select('member_key, dedupe_key')
      .in('member_key', memberKeys)
      .in('dedupe_key', dedupeKeys)

    ;(data || []).forEach((row) => {
      const memberKey = String((row as { member_key?: string }).member_key || '')
      const dedupeKey = String((row as { dedupe_key?: string }).dedupe_key || '')
      if (memberKey && dedupeKey) {
        existingNotifications.add(`${memberKey}|${dedupeKey}`)
      }
    })
  }

  let sent = 0
  let created = 0
  const expiredSubscriptionIds: string[] = []

  for (const candidate of candidates) {
    const identity = `${candidate.memberKey}|${candidate.dedupeKey}`
    if (existingNotifications.has(identity)) continue

    const { data: insertedRows, error } = await supabase
      .from('notifications')
      .upsert({
        member_key: candidate.memberKey,
        actor_member_key: null,
        type: candidate.type,
        title: candidate.title,
        body: candidate.body,
        dedupe_key: candidate.dedupeKey,
        payload: candidate.payload,
      }, {
        onConflict: 'member_key,dedupe_key',
        ignoreDuplicates: true,
      })
      .select('id')

    if (error) {
      console.error('Calendar notification insert failed:', error)
      continue
    }

    if (!Array.isArray(insertedRows) || insertedRows.length === 0) {
      continue
    }

    created++

    const memberSubscriptions = subscriptionsByMember.get(candidate.memberKey) || []
    for (const subscription of memberSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: candidate.pushTitle,
            body: candidate.pushBody,
            url: '/',
          })
        )
        sent++
      } catch (error) {
        if (isExpiredSubscriptionError(error)) {
          expiredSubscriptionIds.push(subscription.id)
        } else {
          console.error('Calendar push failed:', error)
        }
      }
    }
  }

  if (expiredSubscriptionIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', [...new Set(expiredSubscriptionIds)])
  }

  return new Response(JSON.stringify({
    scannedMembers: members.length,
    candidates: candidates.length,
    created,
    sent,
    removed: [...new Set(expiredSubscriptionIds)].length,
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
