import { supabase } from './supabase'

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
  const options: SendPushOptions = typeof optionsOrExcludeMember === 'string'
    ? { excludeMember: optionsOrExcludeMember, url }
    : { ...(optionsOrExcludeMember || {}), url: optionsOrExcludeMember?.url || url }

  const targetMemberKeys = [...new Set((options.targetMemberKeys || []).filter(Boolean))]
    .filter((memberKey) => memberKey !== options.excludeMember)

  if (options.targetMemberKeys && targetMemberKeys.length === 0) return

  try {
    await supabase.functions.invoke('send-push', {
      body: {
        title,
        body,
        url: options.url || '/',
        exclude_member: options.excludeMember,
        target_member_keys: targetMemberKeys.length > 0 ? targetMemberKeys : undefined,
      },
    })
  } catch (err) {
    console.error('sendPush failed:', err)
  }
}
