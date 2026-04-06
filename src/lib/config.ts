// ═══════════════════════════════════════════════════════════════
// config.ts — Centraliserad konfiguration för Sektionen HQ
// Alla hårdkodade värden samlade på ett ställe.
// ═══════════════════════════════════════════════════════════════

/** localStorage-nyckel för speldata */
export const STORAGE_KEY = 'sek-v6';

/** AI-modell för Claude API */
export const AI_MODEL = 'claude-sonnet-4-20250514';

/** Säsongsdata */
export const SEASON_DEFAULTS = {
  startDate: '2026-03-01T00:00:00',
  start: '2026-03-18',
  end: '2026-07-31',
  operationName: 'Operation POST II',
} as const;

/** Supabase sync-inställningar */
export const SYNC_CONFIG = {
  debounceMs: 1500,
  maxRetries: 3,
  feedLimit: 50,
  notificationLimit: 50,
} as const;

/** XP-relaterade tröskelvärden */
export const XP_CONFIG = {
  insightBonus: 15,
  milestoneThreshold: 150,
  maxStreakMultiplier: 0.80,
} as const;

/** Initial metrics */
export const DEFAULT_METRICS = {
  spf: 110,
  str: 45500,
  ig: 209,
  x: 0,
  tix: 0,
} as const;
