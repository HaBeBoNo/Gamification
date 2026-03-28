// ═══════════════════════════════════════════════════════════════
// src/types/game.ts — Gemensamma typdefinitioner för Sektionen
//
// Importeras av store.ts, notifications.ts, useXP.ts m.fl.
// Ingen spellogik — bara typer.
// ═══════════════════════════════════════════════════════════════

// ── Notifikationer ───────────────────────────────────────────────

export interface Notification {
  id:        number;
  type:      string;
  ts:        number;
  read:      boolean;
  title?:    string;
  body?:     string;
  memberKey?: string;
  payload?:  Record<string, unknown>;
}

// ── Karaktärsdata ────────────────────────────────────────────────

export interface CharStats {
  vit: number;
  wis: number;
  for: number;
  cha: number;
}

export interface CharPts {
  work:    number;
  spotify: number;
  social:  number;
  bonus:   number;
}

export interface TemporalBehavior {
  history:     number[];
  pattern:     'early' | 'deadline-driven' | 'steady' | 'unknown';
  avgUrgency:  number;
  anomaly:     boolean;
  lastUpdated?: number;
}

export interface CharData {
  id:              string;
  level:           number;
  xp:              number;
  xpToNext:        number;
  totalXp:         number;
  questsDone:      number;
  streak:          number;
  lastSeen:        number;
  lastQuestDate?:  number;
  categoryCount:   Record<string, number>;
  stats:           CharStats;
  motivation:      string;
  roleEnjoy:       string;
  roleDrain:       string;
  hiddenValue:     string;
  gap:             string;
  roleType:        string;
  pts:             CharPts;
  form:            Array<'W' | 'L'>;
  temporalBehavior?:  TemporalBehavior;
  generatedHistory?:  string[];
  coachLog?:          Array<{ user?: string; coach?: string; ts: number }>;
  completedQuests?:   unknown[];
  deletedQuests?:     unknown[];
  responseProfile?:   ResponseProfile;
  lastCalibration?:   number;
  [key: string]:      unknown;  // escape hatch for dynamic fields
}

// ── ResponseProfile (from useResponseProfile.ts) ─────────────────

export interface ResponseProfile {
  verbosity:          number[];
  resonanceScore:     number[];
  register:           'concrete' | 'abstract' | 'mixed';
  tone:               'analytical' | 'emotional' | 'neutral';
  languageComplexity: 'simple' | 'moderate' | 'complex';
  metaphorical:       boolean;
  pronounDominance:   'jag' | 'vi' | 'man';
  dominantTheme:      string;
  silences:           string[];
  tensions:           string[];
  engagement:         'surface' | 'deep';
  resonantQuestions:  number[];
  onboardingSnapshot: { rawAnswers: string[]; completedAt: number };
  drift:              string | null;
}

// ── Quests ───────────────────────────────────────────────────────

export interface Quest {
  id:            number;
  owner:         string;
  title:         string;
  desc:          string;
  cat:           string;
  xp:            number;
  stars?:        string;
  region:        string;
  recur:         'none' | 'daily' | 'weekly';
  type:          string;
  done:          boolean;
  aiVerdict?:    { text: string; cls: string } | null;
  aiThinking?:   boolean;
  personal:      boolean;
  collaborative?: boolean;
  participants?:  string[];
  deadline?:     number;
  createdAt?:    number;
  insight?:      string;
  retroactive?:  boolean;
  completedAt?:  number;
  [key: string]: unknown;
}

// ── Metrics ──────────────────────────────────────────────────────

export interface Metrics {
  spf: number;
  str: number;
  ig:  number;
  x:   number;
  tix: number;
}

// ── Feed ─────────────────────────────────────────────────────────

export interface FeedEntry {
  who:    string;
  action: string;
  ts?:    string;   // HH:MM timestamp (most entries)
  time?:  string;   // alias used by some callers (insight bonus)
  xp?:    number;
}

// ── Zustand store state ──────────────────────────────────────────

export interface GameStoreState {
  tick:          number;
  notifications: Notification[];
}
