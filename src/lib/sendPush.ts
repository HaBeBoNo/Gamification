import { supabase } from './supabase'

export async function sendPush(
  title: string,
  body: string,
  excludeMember?: string,
  url: string = '/'
): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', {
      body: { title, body, url, exclude_member: excludeMember },
    })
  } catch (err) {
    console.error('sendPush failed:', err)
  }
}
