// ═══════════════════════════════════════════════════════════════
// store.ts — Sektionen Gamification · Zustand-backed state
//
// ARKITEKTUR — nuläge
// ───────────────────
//   S  är ett mutable singleton-objekt som initieras från localStorage.
//   All spellogik muterar S direkt (t.ex. S.chars[id].xp += 10).
//   save()   persisterar S till localStorage och triggar Zustand notify().
//   notify() triggar re-render i alla prenumeranter utan att spara.
//
//   Komponenter prenumererar via:
//     useGameStore(s => s.tick)              → re-render vid varje save()/notify()
//     useGameStore(s => s.notifications)     → direkt reactive slice (migrerat)
//
// MIGRATION S → ZUSTAND — körplan
// ────────────────────────────────
//   Problemet med S-mönstret:
//     • Mutable referens → React.memo och useMemo stoppar inte re-renders korrekt
//     • Ingen TypeScript-typning → runtime-fel syns sent
//     • Inga selectors → alla prenumeranter re-renderar på varje save()
//     • Svårt att testa isolerat (S är global singleton)
//
//   Migrationsordning (hög → låg risk):
//
//   Fas 1 — Isolerade slices (inga beroenden på S)     [✓ KLAR]
//     notifications[]  → useGameStore.notifications    [✓]
//
//   Fas 2 — Enkla primitiver
//     S.me             → useGameStore(s => s.me)
//     S.tab            → useGameStore(s => s.activeTab)
//     S.adminMode      → useGameStore(s => s.adminMode)
//     S.weekNum        → useGameStore(s => s.weekNum)
//
//   Fas 3 — Komplexa objekt (kräver immer eller manuell spridning)
//     S.metrics / S.prev
//     S.feed[]
//     S.checkIns[]
//     S.weeklyCheckouts{}
//
//   Fas 4 — Tung speldata (hög risk, kräver full testmiljö)
//     S.chars{}        — 8 member-objekt med 15+ fält var
//     S.quests[]       — 100+ quests med dynamiska fält
//
//   Genomförande per fas:
//     1. Lägg till fältet i useGameStore initial state (nedan)
//     2. Skriv om muteringar till useGameStore.setState(s => ...)
//     3. Ersätt S.field-läsningar med useGameStore(s => s.field) i komponenter
//     4. Ta bort fältet från S och localStorage-serialiseringen i save()
//     5. Kör tsc --noEmit + manuellt röktest
//
//   Estimat: Fas 2 ≈ 1 dag · Fas 3 ≈ 2 dagar · Fas 4 ≈ 1–2 veckor
//   Fas 4 bör göras med feature-flagga och parallell körning av S + Zustand.
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { MEMBERS, ROLE_TYPES } from '../data/members';
import { BASE_QUESTS } from '../data/quests';
import { syncToSupabase } from '../hooks/useSupabaseSync';
import { STORAGE_KEY, SEASON_DEFAULTS, SYNC_CONFIG, DEFAULT_METRICS } from '../lib/config';
import { clearRuntimeIssue, setRuntimeIssue } from '../lib/runtimeHealth';
import type { GameStoreState, CharData, Quest, Metrics, FeedEntry, Notification } from '../types/game';

// ── Zustand store ────────────────────────────────────────────────

export const useGameStore = create<GameStoreState>(() => ({
  tick:          0,
  notifications: [],
}));

/**
 * notify() — triggar re-render i alla Zustand-prenumeranter.
 * Anropas av save() automatiskt, men kan även anropas direkt
 * för icke-persisterade state-ändringar (t.ex. aiThinking).
 */
export function notify(): void {
  useGameStore.setState(prev => ({ tick: prev.tick + 1 }));
}

// ── Supabase sync (debounced) ─────────────────────────────────────
// Batchar täta save()-anrop (t.ex. under en XP-award-sekvens) till
// ett enda API-anrop. 1 500 ms trailing debounce.

let _supabaseSyncTimer: ReturnType<typeof setTimeout> | null = null;

let _supabaseSyncRetryCount = 0;

function supabaseSync(memberKey: string): void {
  if (_supabaseSyncTimer) clearTimeout(_supabaseSyncTimer);
  _supabaseSyncTimer = setTimeout(() => {
    syncToSupabase(memberKey)
      .then(() => {
        _supabaseSyncRetryCount = 0;
        clearRuntimeIssue('sync');
      })
      .catch((err) => {
        console.error('[Sync] Supabase sync failed:', err);
        _supabaseSyncRetryCount++;
        if (_supabaseSyncRetryCount <= SYNC_CONFIG.maxRetries) {
          const backoff = Math.min(2000 * Math.pow(2, _supabaseSyncRetryCount - 1), 15000);
          console.warn(`[Sync] Retry ${_supabaseSyncRetryCount}/${SYNC_CONFIG.maxRetries} in ${backoff}ms`);
          setTimeout(() => supabaseSync(memberKey), backoff);
        } else {
          console.error('[Sync] Max retries reached — data may not be saved');
          _supabaseSyncRetryCount = 0;
          setRuntimeIssue('sync', 'Serverkopplingen är ojämn just nu. Dina ändringar fortsätter sparas lokalt.', 'warn');
          // Dispatch custom event so NetworkToast can pick it up
          window.dispatchEvent(new CustomEvent('sek:sync-error', {
            detail: { message: 'Kunde inte synka till servern. Dina ändringar finns sparade lokalt.' },
          }));
        }
      });
  }, SYNC_CONFIG.debounceMs);
}

// ── Hjälpfunktioner ──────────────────────────────────────────────

export const SEASON_START_DATE = new Date(SEASON_DEFAULTS.startDate);

export function calcWeekNum(): number {
  const now  = new Date();
  const diff = now.getTime() - SEASON_START_DATE.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function now(): string {
  return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function normalizeFeedTimestampForDedup(value: unknown): string {
  if (!value) return '';
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString().slice(0, 19);
}

function dedupeLocalFeed(feed: FeedEntry[]): FeedEntry[] {
  const seen = new Set<string>();
  const deduped: FeedEntry[] = [];

  for (const item of feed || []) {
    const key = [
      item?.who || '',
      item?.action || '',
      normalizeFeedTimestampForDedup(item?.created_at || item?.ts || item?.time || ''),
      item?.type || item?.interaction_type || 'activity',
      Number(item?.xp || 0),
    ].join('|');

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

export function defChar(id: string): CharData {
  const rt = (MEMBERS as Record<string, { roleType?: string }>)[id]?.roleType || 'amplifier';
  return {
    id,
    level: 1, xp: 0, xpToNext: 100, totalXp: 0, questsDone: 0, streak: 0,
    lastSeen: Date.now(), categoryCount: {}, stats: { vit: 10, wis: 10, for: 10, cha: 10 },
    motivation: '', roleEnjoy: '', roleDrain: '', hiddenValue: '', gap: '',
    roleType: rt,
    pts: { work: 0, spotify: 0, social: 0, bonus: 0 }, form: [],
  };
}

// ── State-typer för S ────────────────────────────────────────────

interface SState {
  checkIns:       unknown[];
  me:             string | null;
  onboarded:      boolean;
  chars:          Record<string, CharData>;
  quests:         Quest[];
  metrics:        Metrics;
  prev:           Metrics;
  feed:           FeedEntry[];
  tab:            string;
  coachText:      string;
  weekNum:        number;
  adminMode:      boolean;
  operationName:  string;
  weeklyCheckouts: Record<string, unknown>;
  seasonStart:    string;
  seasonEnd:      string;
  [key: string]:  unknown;  // escape hatch for dynamic runtime properties
}

// ── State-initiering från localStorage ───────────────────────────

const RAW = (() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Record<string, unknown> | null; }
  catch { return null; }
})();

useGameStore.setState({
  notifications: ((RAW?.notifications as Notification[]) || []).slice(0, SYNC_CONFIG.notificationLimit),
});

export const S: SState = {
  checkIns:       (RAW?.checkIns as unknown[])  || [],
  me:             (RAW?.me as string | null)     || null,
  onboarded:      (RAW?.onboarded as boolean)    || false,
  chars: (() => {
    const c: Record<string, CharData> = {};
    Object.keys(MEMBERS as object).forEach(id => {
      c[id] = (RAW as Record<string, Record<string, CharData>>)?.chars?.[id] || defChar(id);
    });
    return c;
  })(),
  quests: (RAW?.quests as Quest[]) || (BASE_QUESTS as unknown[]).map((q) => ({
    ...(q as Record<string, unknown>), done: false, aiVerdict: null, personal: false,
  })) as Quest[],
  metrics:        (RAW?.metrics as Metrics) || DEFAULT_METRICS,
  prev:           (RAW?.prev    as Metrics) || DEFAULT_METRICS,
  feed:           dedupeLocalFeed((RAW?.feed as FeedEntry[]) || []),
  tab:            'personal',
  coachText:      '',
  weekNum:        calcWeekNum(),
  adminMode:      false,
  operationName:  (RAW?.operationName as string)  || SEASON_DEFAULTS.operationName,
  weeklyCheckouts:(RAW?.weeklyCheckouts as Record<string, unknown>) || {},
  seasonStart:    (RAW?.seasonStart as string)    || SEASON_DEFAULTS.start,
  seasonEnd:      (RAW?.seasonEnd   as string)    || SEASON_DEFAULTS.end,
};

// ── Persist + notify ─────────────────────────────────────────────

export function save(): void {
  S.feed = dedupeLocalFeed(S.feed || []);
  const notifications = useGameStore.getState().notifications;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    me:              S.me,
    onboarded:       S.onboarded,
    chars:           S.chars,
    quests:          S.quests,
    feed:            S.feed,
    metrics:         S.metrics,
    prev:            S.prev,
    checkIns:        S.checkIns,
    operationName:   S.operationName,
    weeklyCheckouts: S.weeklyCheckouts,
    notifications,
    seasonStart:     S.seasonStart,
    seasonEnd:       S.seasonEnd,
  }));

  // Trigga Zustand-reaktivitet
  notify();

  // Sync till Supabase om inloggad
  if (S.me) {
    supabaseSync(S.me);
  }
}

// Suppress unused import warnings (ROLE_TYPES used by consumers via re-export)
void ROLE_TYPES;
