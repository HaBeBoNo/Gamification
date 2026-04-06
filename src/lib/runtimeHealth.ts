export type RuntimeService = 'ai' | 'push' | 'sync';
export type RuntimeIssueLevel = 'info' | 'warn' | 'error';

export interface RuntimeIssue {
  service: RuntimeService;
  level: RuntimeIssueLevel;
  message: string;
  ts: number;
}

const STORAGE_KEY = 'sek-runtime-health-v1';
export const RUNTIME_ISSUE_EVENT = 'sek:runtime-issue';
export const RUNTIME_ISSUE_CLEAR_EVENT = 'sek:runtime-issue-clear';

function normalizeRuntimeMessage(message: string): string {
  return (message || '')
    .replace(/kor/g, 'kör')
    .replace(/reservlage/g, 'reservläge')
    .replace(/fortsatter/g, 'fortsätter')
    .replace(/ar /g, 'är ')
    .replace(/begransade/g, 'begränsade');
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readIssueMap(): Partial<Record<RuntimeService, RuntimeIssue>> {
  if (!canUseStorage()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeIssueMap(issues: Partial<Record<RuntimeService, RuntimeIssue>>): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(issues));
  } catch {
    // Ignore storage failures.
  }
}

export function getRuntimeIssues(): RuntimeIssue[] {
  return Object.values(readIssueMap())
    .filter(Boolean)
    .map((issue) => ({
      ...issue,
      message: normalizeRuntimeMessage(issue?.message || ''),
    }))
    .sort((a, b) => b.ts - a.ts) as RuntimeIssue[];
}

export function setRuntimeIssue(
  service: RuntimeService,
  message: string,
  level: RuntimeIssueLevel = 'warn',
  options?: { toast?: boolean },
): void {
  const issue: RuntimeIssue = {
    service,
    level,
    message: normalizeRuntimeMessage(message),
    ts: Date.now(),
  };

  const nextIssues = readIssueMap();
  nextIssues[service] = issue;
  writeIssueMap(nextIssues);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RUNTIME_ISSUE_EVENT, {
      detail: {
        issue,
        toast: options?.toast ?? false,
      },
    }));
  }
}

export function clearRuntimeIssue(service: RuntimeService): void {
  const nextIssues = readIssueMap();
  delete nextIssues[service];
  writeIssueMap(nextIssues);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RUNTIME_ISSUE_CLEAR_EVENT, {
      detail: { service },
    }));
  }
}
