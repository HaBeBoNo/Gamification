import { supabase } from './supabase'
import { clearRuntimeIssue, setRuntimeIssue } from './runtimeHealth'

export interface SendPushOptions {
  excludeMember?: string
  targetMemberKeys?: string[]
  url?: string
}

export async function sendPush(
  title: string,
  body: string,
  optionsOrExcludeMember?: string | SendPushOptions,
  url: string = '/'
): Promise<void> {
  if (!supabase) return

  const options: SendPushOptions = typeof optionsOrExcludeMember === 'string'
    ? { excludeMember: optionsOrExcludeMember, url }
    : { ...(optionsOrExcludeMember || {}), url: optionsOrExcludeMember?.url || url }

  const targetMemberKeys = [...new Set((options.targetMemberKeys || []).filter(Boolean))]
    .filter((memberKey) => memberKey !== options.excludeMember)

  if (options.targetMemberKeys && targetMemberKeys.length === 0) return

  async function invokeVercelPushRoute() {
    const response = await fetch('/api/send-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        url: options.url || '/',
        exclude_member: options.excludeMember,
        target_member_keys: targetMemberKeys.length > 0 ? targetMemberKeys : undefined,
      }),
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const error = new Error((data && typeof data === 'object' && 'error' in data && String(data.error)) || 'Push route failed')
      ;(error as Error & { details?: unknown }).details = data
      throw error
    }
    return data
  }

  async function invokeSupabasePushFunction() {
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: {
        title,
        body,
        url: options.url || '/',
        exclude_member: options.excludeMember,
        target_member_keys: targetMemberKeys.length > 0 ? targetMemberKeys : undefined,
      },
    })
    if (error) throw error
    return data
  }

  try {
    let data: unknown
    try {
      data = await invokeVercelPushRoute()
    } catch (routeError) {
      console.warn('Vercel push route failed, falling back to Supabase function:', routeError)
      data = await invokeSupabasePushFunction()
    }
    if (data && typeof data === 'object') {
      const sent = Number((data as { sent?: number }).sent || 0)
      const targeted = Number((data as { targeted?: number }).targeted || 0)
      if (sent > 0 || targeted === 0) {
        clearRuntimeIssue('push')
      }
    }
  } catch (err) {
    setRuntimeIssue('push', 'Push-signalerna nådde inte fram just nu.', 'info')
    console.error('sendPush failed:', err)
  }
}
