import type { HomeAttentionSignal, HomeReengagementPlan } from '@/lib/homeSurface';

const HOME_SURFACE_CACHE_PREFIX = 'sek-home-surface:';

type HomeSurfaceCacheRecord<T> = {
  updatedAt: number;
  value: T;
};

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getCacheKey(scope: string, memberKey: string): string {
  return `${HOME_SURFACE_CACHE_PREFIX}${scope}:${memberKey}`;
}

function readCacheRecord<T>(scope: string, memberKey: string): HomeSurfaceCacheRecord<T> | null {
  if (!canUseLocalStorage() || !memberKey) return null;

  try {
    const raw = window.localStorage.getItem(getCacheKey(scope, memberKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeSurfaceCacheRecord<T> | null;
    if (!parsed || typeof parsed !== 'object' || !('updatedAt' in parsed) || !('value' in parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCacheRecord<T>(scope: string, memberKey: string, value: T): void {
  if (!canUseLocalStorage() || !memberKey) return;

  try {
    window.localStorage.setItem(
      getCacheKey(scope, memberKey),
      JSON.stringify({
        updatedAt: Date.now(),
        value,
      } satisfies HomeSurfaceCacheRecord<T>),
    );
  } catch {
    // Ignore storage failures; home surfaces still work in-session.
  }
}

export function loadCachedReengagementPlan(memberKey: string): {
  hasEntry: boolean;
  value: HomeReengagementPlan | null;
} {
  const record = readCacheRecord<HomeReengagementPlan | null>('reengagement-plan', memberKey);
  return {
    hasEntry: Boolean(record),
    value: record?.value ?? null,
  };
}

export function saveCachedReengagementPlan(memberKey: string, value: HomeReengagementPlan | null): void {
  writeCacheRecord('reengagement-plan', memberKey, value);
}

export function loadCachedWaitingSignals(memberKey: string): {
  hasEntry: boolean;
  value: HomeAttentionSignal[];
} {
  const record = readCacheRecord<HomeAttentionSignal[]>('waiting-signals', memberKey);
  return {
    hasEntry: Boolean(record),
    value: Array.isArray(record?.value) ? record.value : [],
  };
}

export function saveCachedWaitingSignals(memberKey: string, value: HomeAttentionSignal[]): void {
  writeCacheRecord('waiting-signals', memberKey, value);
}
