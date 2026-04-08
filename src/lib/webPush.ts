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

export type PushReadiness =
  | 'active'
  | 'needs-install'
  | 'needs-permission'
  | 'blocked'
  | 'needs-reconnect'
  | 'unsupported'

export interface PushReadinessState {
  state: PushReadiness
  message: string
  canActivate: boolean
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

function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone)
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent || '')
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
      if (permission === 'denied') {
        setRuntimeIssue('push', 'Tillåt notiser för HQ för att få spontana signaler från bandet.', 'info', { toast: true })
      } else {
        clearRuntimeIssue('push')
      }
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

export async function getPushReadiness(memberKey?: string | null): Promise<PushReadinessState> {
  if (isIOS() && !isStandaloneDisplayMode()) {
    return {
      state: 'needs-install',
      message: 'Installera HQ på hemskärmen för att iPhone ska kunna ta emot push.',
      canActivate: false,
    }
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    return {
      state: 'unsupported',
      message: 'Push stöds inte fullt ut i den här miljön ännu. Öppna HQ som installerad app eller prova en annan enhet.',
      canActivate: false,
    }
  }

  if (Notification.permission === 'denied') {
    return {
      state: 'blocked',
      message: 'Push är blockerat på den här enheten. Tillåt notiser för HQ och försök igen.',
      canActivate: false,
    }
  }

  if (Notification.permission !== 'granted') {
    return {
      state: 'needs-permission',
      message: 'Aktivera push för att få spontana signaler när bandet rör sig.',
      canActivate: true,
    }
  }

  const registration = await getPushRegistration()
  if (!registration) {
    return {
      state: 'unsupported',
      message: 'HQ kunde inte starta push på den här enheten.',
      canActivate: false,
    }
  }

  const subscription = await registration.pushManager.getSubscription()
  const endpoint = subscription?.endpoint || ''
  if (!subscription) {
    return {
      state: 'needs-reconnect',
      message: 'Push är tillåtet men saknar aktiv koppling. Återaktivera så att bandets signaler når fram.',
      canActivate: true,
    }
  }

  if (memberKey && shouldForceRefresh(memberKey, endpoint)) {
    return {
      state: 'needs-reconnect',
      message: 'Pushkopplingen behöver fräschas upp för att signalerna ska nå rätt enhet.',
      canActivate: true,
    }
  }

  return {
    state: 'active',
    message: 'Push är aktivt på den här enheten.',
    canActivate: false,
  }
}

export async function ensurePushRegistration(
  memberKey: string,
  options: { promptIfNeeded?: boolean; reason?: 'auth' | 'resume' | 'online' | 'bootstrap' | 'manual' } = {}
): Promise<boolean> {
  const current = loadPushRegistrationState()
  const refreshDue = !current || current.memberKey !== memberKey || (Date.now() - current.registeredAt > PUSH_REFRESH_INTERVAL_MS)

  return registerPush(memberKey, {
    forceRefresh: options.reason === 'manual' || ((options.reason === 'resume' || options.reason === 'online') && refreshDue),
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
