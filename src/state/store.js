import { MEMBERS, ROLE_TYPES } from '../data/members';
import { BASE_QUESTS } from '../data/quests';
import { syncToSupabase } from '../hooks/useSupabaseSync';

function supabaseSync(memberKey) {
  syncToSupabase(memberKey).catch(() => {});
}

export const SEASON_START_DATE = new Date('2026-03-01T00:00:00');

export function calcWeekNum() {
  const now = new Date();
  const diff = now - SEASON_START_DATE;
  if (diff < 0) return 0;
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// xpForLevel borttagen härifrån — auktoritativ version finns i useXP.js
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
};

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
  }));

  // Sync till Supabase om inloggad
  if (S.me) {
    supabaseSync(S.me);
  }
}
