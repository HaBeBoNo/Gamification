export type BandHubNavigationIntent = {
  tab: 'kalender' | 'drive';
  source?: string;
  ts: number;
};

const BAND_HUB_INTENT_KEY = 'sek-bandhub-intent-v1';

function hasSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function queueBandHubIntent(intent: Omit<BandHubNavigationIntent, 'ts'>) {
  if (!hasSessionStorage()) return;

  try {
    const payload: BandHubNavigationIntent = {
      ...intent,
      ts: Date.now(),
    };
    window.sessionStorage.setItem(BAND_HUB_INTENT_KEY, JSON.stringify(payload));
  } catch {
    // Ignore blocked storage access.
  }
}

export function consumeBandHubIntent(): BandHubNavigationIntent | null {
  if (!hasSessionStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(BAND_HUB_INTENT_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(BAND_HUB_INTENT_KEY);
    const parsed = JSON.parse(raw) as Partial<BandHubNavigationIntent>;
    if (parsed?.tab !== 'kalender' && parsed?.tab !== 'drive') return null;
    return {
      tab: parsed.tab,
      source: typeof parsed.source === 'string' ? parsed.source : undefined,
      ts: typeof parsed.ts === 'number' ? parsed.ts : Date.now(),
    };
  } catch {
    return null;
  }
}
