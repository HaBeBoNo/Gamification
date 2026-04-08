type AppOpenSource = 'push' | 'direct';
type SocialResponseType = 'feed_comment' | 'feed_reaction' | 'feed_witness';

interface AppOpenEvent {
  memberKey: string;
  ts: number;
  source: AppOpenSource;
  path: string;
}

interface SocialResponseLatencySample {
  memberKey: string;
  feedItemId: string;
  responseType: SocialResponseType;
  actionTs: number;
  responseTs: number;
  latencyMs: number;
  recordedAt: number;
}

interface ProductBaselineState {
  version: 1;
  appOpens: AppOpenEvent[];
  socialResponseLatencies: SocialResponseLatencySample[];
}

const STORAGE_KEY = 'sek-product-baseline-v1';
const SESSION_PREFIX = 'sek-product-baseline-session';
const PUSH_OPEN_PARAM = 'sek_push_open';
const MAX_APP_OPEN_EVENTS = 180;
const MAX_SOCIAL_RESPONSE_SAMPLES = 180;
const MAX_SAMPLE_AGE_MS = 120 * 24 * 60 * 60 * 1000;

function hasStorage(storage: 'localStorage' | 'sessionStorage'): boolean {
  return typeof window !== 'undefined' && typeof window[storage] !== 'undefined';
}

function emptyState(): ProductBaselineState {
  return {
    version: 1,
    appOpens: [],
    socialResponseLatencies: [],
  };
}

function trimByAge<T extends { ts?: number; recordedAt?: number }>(items: T[], maxItems: number): T[] {
  const cutoff = Date.now() - MAX_SAMPLE_AGE_MS;
  return [...items]
    .filter((item) => {
      const timestamp = Number(item.recordedAt ?? item.ts ?? 0);
      return !timestamp || timestamp >= cutoff;
    })
    .sort((a, b) => Number((b.recordedAt ?? b.ts ?? 0)) - Number((a.recordedAt ?? a.ts ?? 0)))
    .slice(0, maxItems);
}

function loadState(): ProductBaselineState {
  if (!hasStorage('localStorage')) return emptyState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();

    const parsed = JSON.parse(raw) as Partial<ProductBaselineState>;
    return {
      version: 1,
      appOpens: Array.isArray(parsed.appOpens) ? parsed.appOpens : [],
      socialResponseLatencies: Array.isArray(parsed.socialResponseLatencies)
        ? parsed.socialResponseLatencies
        : [],
    };
  } catch {
    return emptyState();
  }
}

function saveState(state: ProductBaselineState): void {
  if (!hasStorage('localStorage')) return;

  const nextState: ProductBaselineState = {
    version: 1,
    appOpens: trimByAge(state.appOpens, MAX_APP_OPEN_EVENTS),
    socialResponseLatencies: trimByAge(state.socialResponseLatencies, MAX_SOCIAL_RESPONSE_SAMPLES),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Best effort only; baseline telemetry should never break the app.
  }
}

function sessionKey(memberKey: string): string {
  return `${SESSION_PREFIX}:${memberKey}`;
}

export function consumePushOpenMarker(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const url = new URL(window.location.href);
    const marker = url.searchParams.get(PUSH_OPEN_PARAM);
    if (marker !== '1') return false;

    url.searchParams.delete(PUSH_OPEN_PARAM);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    return true;
  } catch {
    return false;
  }
}

export function recordAppOpenOncePerSession(params: {
  memberKey: string;
  source: AppOpenSource;
  path?: string;
}): void {
  if (!params.memberKey || !hasStorage('sessionStorage')) return;

  const key = sessionKey(params.memberKey);
  try {
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // If sessionStorage is blocked we still try to record once.
  }

  const state = loadState();
  state.appOpens.unshift({
    memberKey: params.memberKey,
    ts: Date.now(),
    source: params.source,
    path: params.path || '/',
  });
  saveState(state);
}

export function clearBaselineSession(memberKey: string): void {
  if (!memberKey || !hasStorage('sessionStorage')) return;
  try {
    window.sessionStorage.removeItem(sessionKey(memberKey));
  } catch {
    // Ignore cleanup failures.
  }
}

export function hasRecordedSocialLatency(memberKey: string, feedItemId: string): boolean {
  if (!memberKey || !feedItemId) return false;
  return loadState().socialResponseLatencies.some(
    (sample) => sample.memberKey === memberKey && sample.feedItemId === feedItemId
  );
}

export function recordSocialResponseLatencies(
  memberKey: string,
  samples: Array<{
    feedItemId: string;
    responseType: SocialResponseType;
    actionTs: number;
    responseTs: number;
  }>
): void {
  if (!memberKey || samples.length === 0) return;

  const state = loadState();
  const existing = new Set(
    state.socialResponseLatencies
      .filter((sample) => sample.memberKey === memberKey)
      .map((sample) => sample.feedItemId)
  );

  for (const sample of samples) {
    if (!sample.feedItemId || existing.has(sample.feedItemId)) continue;
    if (!Number.isFinite(sample.actionTs) || !Number.isFinite(sample.responseTs)) continue;
    const latencyMs = sample.responseTs - sample.actionTs;
    if (latencyMs < 0) continue;

    state.socialResponseLatencies.unshift({
      memberKey,
      feedItemId: sample.feedItemId,
      responseType: sample.responseType,
      actionTs: sample.actionTs,
      responseTs: sample.responseTs,
      latencyMs,
      recordedAt: Date.now(),
    });
    existing.add(sample.feedItemId);
  }

  saveState(state);
}

export function getProductBaselineSnapshot(memberKey?: string): ProductBaselineState {
  const state = loadState();
  if (!memberKey) return state;

  return {
    version: 1,
    appOpens: state.appOpens.filter((entry) => entry.memberKey === memberKey),
    socialResponseLatencies: state.socialResponseLatencies.filter((entry) => entry.memberKey === memberKey),
  };
}

