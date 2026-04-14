export type BandHubNavigationIntent = {
  tab: 'kalender' | 'drive';
  eventId?: string;
  source?: string;
  ts: number;
};

const BAND_HUB_INTENT_KEY = 'sek-bandhub-intent-v1';
const BAND_HUB_INTENT_EVENT = 'sek-bandhub-intent';
const NAV_ROUTE_PARAM = 'sek_nav';
const NAV_TAB_PARAM = 'sek_bandhub_tab';
const NAV_EVENT_PARAM = 'sek_event_id';
const NAV_SOURCE_PARAM = 'sek_nav_source';

export type QueuedBandHubIntent = Omit<BandHubNavigationIntent, 'ts'>;

function hasSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function normalizeIntent(intent: Partial<BandHubNavigationIntent>): BandHubNavigationIntent | null {
  if (intent?.tab !== 'kalender' && intent?.tab !== 'drive') return null;
  return {
    tab: intent.tab,
    eventId: typeof intent.eventId === 'string' && intent.eventId ? intent.eventId : undefined,
    source: typeof intent.source === 'string' ? intent.source : undefined,
    ts: typeof intent.ts === 'number' ? intent.ts : Date.now(),
  };
}

export function queueBandHubIntent(intent: QueuedBandHubIntent) {
  const payload = normalizeIntent({
    ...intent,
    ts: Date.now(),
  });
  if (!payload) return null;

  try {
    if (hasSessionStorage()) {
      window.sessionStorage.setItem(BAND_HUB_INTENT_KEY, JSON.stringify(payload));
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent<BandHubNavigationIntent>(BAND_HUB_INTENT_EVENT, {
        detail: payload,
      }));
    }
  } catch {
    // Ignore blocked storage access.
  }

  return payload;
}

export function consumeBandHubIntent(): BandHubNavigationIntent | null {
  if (!hasSessionStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(BAND_HUB_INTENT_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(BAND_HUB_INTENT_KEY);
    return normalizeIntent(JSON.parse(raw) as Partial<BandHubNavigationIntent>);
  } catch {
    return null;
  }
}

export function consumeBandHubIntentFromUrl(): BandHubNavigationIntent | null {
  if (typeof window === 'undefined') return null;

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(NAV_ROUTE_PARAM) !== 'bandhub') return null;
    const tabParam = url.searchParams.get(NAV_TAB_PARAM);

    const intent = normalizeIntent({
      tab: tabParam === 'kalender' || tabParam === 'drive' ? tabParam : undefined,
      eventId: url.searchParams.get(NAV_EVENT_PARAM) || undefined,
      source: url.searchParams.get(NAV_SOURCE_PARAM) || 'url',
      ts: Date.now(),
    });

    url.searchParams.delete(NAV_ROUTE_PARAM);
    url.searchParams.delete(NAV_TAB_PARAM);
    url.searchParams.delete(NAV_EVENT_PARAM);
    url.searchParams.delete(NAV_SOURCE_PARAM);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    return intent;
  } catch {
    return null;
  }
}

export function buildBandHubIntentUrl(intent: QueuedBandHubIntent, path = '/'): string {
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://hq.local';
  const url = new URL(path, baseUrl);
  url.searchParams.set(NAV_ROUTE_PARAM, 'bandhub');
  url.searchParams.set(NAV_TAB_PARAM, intent.tab);
  if (intent.eventId) {
    url.searchParams.set(NAV_EVENT_PARAM, intent.eventId);
  }
  if (intent.source) {
    url.searchParams.set(NAV_SOURCE_PARAM, intent.source);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function subscribeToBandHubIntent(listener: (intent: BandHubNavigationIntent) => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => undefined;
  }

  const handleIntent = (event: Event) => {
    const detail = (event as CustomEvent<BandHubNavigationIntent>).detail;
    const intent = normalizeIntent(detail || {});
    if (intent) {
      listener(intent);
    }
  };

  window.addEventListener(BAND_HUB_INTENT_EVENT, handleIntent as EventListener);
  return () => {
    window.removeEventListener(BAND_HUB_INTENT_EVENT, handleIntent as EventListener);
  };
}
