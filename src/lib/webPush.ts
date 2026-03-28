import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export async function registerPush(memberKey: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  try {
    console.log('[Push] Starting registration...')
    const registration = await navigator.serviceWorker.register('/sw.js')
    console.log('[Push] SW registered:', registration)
    const permission = await Notification.requestPermission()
    console.log('[Push] Permission:', permission)
    if (permission !== 'granted') return false
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    const { endpoint, keys } = subscription.toJSON() as any
    await supabase.from('push_subscriptions').upsert({
      member_key: memberKey,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'endpoint' })
    return true
  } catch (err) {
    console.error('Push registration failed:', err)
    return false
  }
}
