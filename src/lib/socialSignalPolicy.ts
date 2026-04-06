const SOCIAL_SYNC_PREFIX = 'sek-social-sync:'

export type SocialSignalType = 'comment' | 'reaction' | 'witness'

export const INITIAL_SOCIAL_BACKFILL_WINDOW_MS = 24 * 60 * 60 * 1000
export const SOCIAL_BACKFILL_WINDOW_MS = 72 * 60 * 60 * 1000

export function shouldPushForSocialSignal(type: SocialSignalType): boolean {
  return type === 'comment'
}

export function getLastSocialSignalSync(memberKey: string): number | null {
  try {
    const raw = localStorage.getItem(`${SOCIAL_SYNC_PREFIX}${memberKey}`)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function setLastSocialSignalSync(memberKey: string, ts: number): void {
  try {
    localStorage.setItem(`${SOCIAL_SYNC_PREFIX}${memberKey}`, String(ts))
  } catch {
    // Ignore storage errors; live notifications still work.
  }
}

export function clearSocialSignalSync(memberKey: string): void {
  try {
    localStorage.removeItem(`${SOCIAL_SYNC_PREFIX}${memberKey}`)
  } catch {
    // Ignore storage errors during logout cleanup.
  }
}

export function getSocialBackfillCutoff(memberKey: string, now = Date.now()): number {
  const lastSync = getLastSocialSignalSync(memberKey)
  if (!lastSync) return now - INITIAL_SOCIAL_BACKFILL_WINDOW_MS
  return Math.max(lastSync, now - SOCIAL_BACKFILL_WINDOW_MS)
}
