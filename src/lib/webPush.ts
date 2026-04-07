import { supabase } from './supabase';
import { clearRuntimeIssue, setRuntimeIssue } from './runtimeHealth';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

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

export async function registerPush(memberKey: string): Promise<boolean> {
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
      : await Notification.requestPermission()
    if (permission !== 'granted') {
      clearRuntimeIssue('push')
      return false
    }

    let subscription = await registration.pushManager.getSubscription()
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
    clearRuntimeIssue('push')
    return true
  } catch (err) {
    setRuntimeIssue('push', 'Push-signaler kunde inte aktiveras på den här enheten.', 'warn')
    console.error('Push registration failed:', err)
    return false
  }
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

    clearRuntimeIssue('push')
  } catch (err) {
    console.warn('Push unregister failed:', err)
  }
}
