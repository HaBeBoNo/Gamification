import { clearRuntimeIssue, setRuntimeIssue } from './runtimeHealth';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export async function registerPush(memberKey: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (!VAPID_PUBLIC_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setRuntimeIssue('push', 'Push-signaler ar inte fullt aktiverade just nu.', 'info');
    return false
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      clearRuntimeIssue('push')
      return false
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    const { endpoint, keys } = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    }
    if (!endpoint || !keys?.p256dh || !keys.auth) return false
    const response = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        member_key: memberKey,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }),
    })
    if (!response.ok) throw new Error(`Push subscription save failed: ${response.status}`)
    clearRuntimeIssue('push')
    return true
  } catch (err) {
    setRuntimeIssue('push', 'Push-signaler kunde inte aktiveras pa den har enheten.', 'warn')
    console.error('Push registration failed:', err)
    return false
  }
}
