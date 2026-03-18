// ═══════════════════════════════════════════════════════════════
// store.js — Sektionen Gamification · Zustand-backed state
//
// Migrationsstrategi:
//   S är fortfarande det globala mutable state-objektet.
//   Zustand-storen håller en tick-counter som triggar reaktivitet.
//   save() persisterar till localStorage OCH notifierar Zustand.
//   notify() triggar re-render utan att spara (för mellansteg).
//
//   Komponenter prenumererar via:
//     import { useGameStore } from '@/state/store';
//     useGameStore(s => s.tick);  // re-renderar vid varje save()/notify()
//
//   Befintlig kod som muterar S direkt fungerar som förut.
//   Framtida migration: flytta fält in i Zustand-storen,
//   lägg till typed selectors, ta bort S.
// ═══════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { MEMBERS, ROLE_TYPES } from '../data/members';
import { BASE_QUESTS } from '../data/quests';
import { syncToSupabase } from '../hooks/useSupabaseSync';

// ── Zustand store ────────────────────────────────────────────────

export const useGameStore = create(() => ({ tick: 0 }));

/**
 * notify() — triggar re-render i alla Zustand-prenumeranter.
 * Anropas av save() automatiskt, men kan även anropas direkt
 * för icke-persisterade state-ändringar (t.ex. aiThinking).
 */
export function notify() {
  useGameStore.setState(prev => ({ tick: prev.tick + 1 }));
}

// ── Supabase sync ────────────────────────────────────────────────

function supabaseSync(memberKey) {
  syncToSupabase(memberKey).catch(() => {});
}

// ── Hjälpfunktioner ──────────────────────────────────────────────

export const SEASON_START_DATE = new Date('2026-03-01T00:00:00');

export function calcWeekNum() {
  const now = new Date();
  const diff = now - SEASON_START_DATE;
  if (diff < 0) return 0;
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function rand(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
export function now() { return new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}); }

export function defChar(id) {
  const rt = MEMBERS[id]?.roleType || 'amplifier';
  return {
    id, level:1, xp:0, xpToNext:100, totalXp:0, questsDone:0, streak:0,
    lastSeen:Date.now(), categoryCount:{}, stats:{vit:10,wis:10,for:10,cha:10},
    motivation:'', roleEnjoy:'', roleDrain:'', hiddenValue:'', gap:'',
    roleType: rt,
    pts:{work:0,spotify:0,social:0,bonus:0}, form:[],
  };
}

// ── State-initiering från localStorage ───────────────────────────

const RAW = (() => { try { return JSON.parse(localStorage.getItem('sek-v6')||'null'); } catch(e) { return null; } })();

export const S = {
  checkIns: RAW?.checkIns || [],
  me: RAW?.me || null,
  onboarded: RAW?.onboarded || false,
  chars: (() => { const c={}; Object.keys(MEMBERS).forEach(id=>{ c[id]=RAW?.chars?.[id]||defChar(id); }); return c; })(),
  quests: RAW?.quests || BASE_QUESTS.map(q=>({...q,done:false,aiVerdict:null,personal:false})),
  metrics: RAW?.metrics || {spf:110,str:45500,ig:209,x:0,tix:0},
  prev:    RAW?.prev    || {spf:110,str:45500,ig:209,x:0,tix:0},
  feed: RAW?.feed || [],
  tab: 'personal',
  coachText: '',
  weekNum: calcWeekNum(),
  adminMode: false,
  operationName: RAW?.operationName || 'Operation POST II',
  weeklyCheckouts: RAW?.weeklyCheckouts || {},
  seasonStart: RAW?.seasonStart || '2026-03-18',
  seasonEnd: RAW?.seasonEnd || '2026-07-31',
};

// ── Persist + notify ─────────────────────────────────────────────

export function save() {
  localStorage.setItem('sek-v6', JSON.stringify({
    me: S.me,
    onboarded: S.onboarded,
    chars: S.chars,
    quests: S.quests,
    feed: S.feed,
    metrics: S.metrics,
    prev: S.prev,
    checkIns: S.checkIns,
    operationName: S.operationName,
    weeklyCheckouts: S.weeklyCheckouts,
    seasonStart: S.seasonStart,
    seasonEnd: S.seasonEnd,
  }));

  // Trigga Zustand-reaktivitet
  notify();

  // Sync till Supabase om inloggad
  if (S.me) {
    supabaseSync(S.me);
  }
}
