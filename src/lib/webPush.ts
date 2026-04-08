import { supabase } from './supabase';
import { clearRuntimeIssue, setRuntimeIssue } from './runtimeHealth';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const PUSH_REGISTRATION_STORAGE_KEY = 'sek-push-registration-v1'
const PUSH_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

type PushRegistrationState = {
  version: 1
  memberKey: string
  endpoint: string
  registeredAt: number
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

function loadPushRegistrationState(): PushRegistrationState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(PUSH_REGISTRATION_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<PushRegistrationState>
    if (!parsed.memberKey || !parsed.endpoint || !parsed.registeredAt) return null

    return {
      version: 1,
      memberKey: parsed.memberKey,
      endpoint: parsed.endpoint,
      registeredAt: Number(parsed.registeredAt) || 0,
    }
  } catch {
    return null
  }
}

function savePushRegistrationState(state: PushRegistrationState): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(PUSH_REGISTRATION_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Best effort only; push registration should still work without local metadata.
  }
}

function clearPushRegistrationState(): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(PUSH_REGISTRATION_STORAGE_KEY)
  } catch {
    // Ignore storage cleanup failures.
  }
}

function getSubscriptionPayload(subscription: PushSubscription) {
  const { endpoint, keys } = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  }

  if (!endpoint || !keys?.p256dh || !keys.auth) return null
  return {
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }
}

function shouldForceRefresh(memberKey: string, endpoint: string): boolean {
  const current = loadPushRegistrationState()
  if (!current) return true
  if (current.memberKey !== memberKey) return true
  if (!endpoint || current.endpoint !== endpoint) return true
  return Date.now() - current.registeredAt > PUSH_REFRESH_INTERVAL_MS
}

export async function registerPush(
  memberKey: string,
  options: { forceRefresh?: boolean; promptIfNeeded?: boolean } = {}
): Promise<boolean> {
  if (!supabase || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!VAPID_PUBLIC_KEY) {
    setRuntimeIssue('push', 'Push-signaler är inte fullt aktiverade just nu.', 'info');
    return false
  }
  try {
    const registration = await getPushRegistration()
    if (!registration) return false

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : options.promptIfNeeded === false
        ? Notification.permission
        : await Notification.requestPermission()
    if (permission !== 'granted') {
      clearRuntimeIssue('push')
      return false
    }

    let subscription = await registration.pushManager.getSubscription()
    const forceRefresh = options.forceRefresh || shouldForceRefresh(memberKey, subscription?.endpoint || '')

    if (subscription && forceRefresh) {
      await subscription.unsubscribe().catch(() => false)
      subscription = null
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const payload = getSubscriptionPayload(subscription)
    if (!payload) return false

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        member_key: memberKey,
        endpoint: payload.endpoint,
        p256dh: payload.p256dh,
        auth: payload.auth,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'endpoint',
      })

    if (error) throw error
    savePushRegistrationState({
      version: 1,
      memberKey,
      endpoint: payload.endpoint,
      registeredAt: Date.now(),
    })
    clearRuntimeIssue('push')
    return true
  } catch (err) {
    setRuntimeIssue('push', 'Push-signaler kunde inte aktiveras på den här enheten.', 'warn')
    console.error('Push registration failed:', err)
    return false
  }
}

export async function ensurePushRegistration(
  memberKey: string,
  options: { promptIfNeeded?: boolean; reason?: 'auth' | 'resume' | 'online' | 'bootstrap' } = {}
): Promise<boolean> {
  const current = loadPushRegistrationState()
  const refreshDue = !current || current.memberKey !== memberKey || (Date.now() - current.registeredAt > PUSH_REFRESH_INTERVAL_MS)

  return registerPush(memberKey, {
    forceRefresh: (options.reason === 'resume' || options.reason === 'online') && refreshDue,
    promptIfNeeded: options.promptIfNeeded,
  })
}

export async function unregisterPush(memberKey?: string | null): Promise<void> {
  if (!supabase || !('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      clearRuntimeIssue('push')
      return
    }

    const endpoint = subscription.endpoint
    await subscription.unsubscribe().catch(() => false)

    let query = supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)

    if (memberKey) {
      query = query.eq('member_key', memberKey)
    }

    const { error } = await query
    if (error) throw error

    clearPushRegistrationState()
    clearRuntimeIssue('push')
  } catch (err) {
    console.warn('Push unregister failed:', err)
  }
}
