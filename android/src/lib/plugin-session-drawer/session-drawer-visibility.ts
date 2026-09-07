import { useCallback, useState } from 'react';

export const SESSION_DRAWER_VISIBILITY_STORAGE_KEY = 'zterm:session-drawer-visibility-filter:v1';

export const SESSION_DRAWER_VISIBILITY_MODES = [
  'all',
  'whitelist-master',
  'blacklist-subagent',
] as const;

export type SessionDrawerVisibilityMode = (typeof SESSION_DRAWER_VISIBILITY_MODES)[number];
export type SessionDrawerVisibilityClass = 'master' | 'subagent' | 'unclassified';

export const DEFAULT_SESSION_DRAWER_VISIBILITY_MODE: SessionDrawerVisibilityMode = 'all';

export const SESSION_DRAWER_VISIBILITY_LABELS: Record<SessionDrawerVisibilityMode, string> = {
  all: '全部',
  'whitelist-master': '仅 master',
  'blacklist-subagent': '隐藏 subagent',
};

interface SessionDrawerVisibilityStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const SUBAGENT_NAME_PATTERN = /(?:^|[-_])subagent(?:[-_]|$)/i;
const MASTER_EXACT_NAME_PATTERN = /^master$/i;
const MASTER_ZTERM_PANE_PATTERN = /^zterm-\d+$/i;
const MASTER_DSH_PLUGIN_PATTERN = /^dsh-plugins-\d+$/i;

export function classifySessionDrawerVisibility(sessionName: string): SessionDrawerVisibilityClass {
  const name = sessionName.trim();
  if (!name) {
    return 'unclassified';
  }
  if (SUBAGENT_NAME_PATTERN.test(name)) {
    return 'subagent';
  }
  if (
    MASTER_EXACT_NAME_PATTERN.test(name)
    || MASTER_ZTERM_PANE_PATTERN.test(name)
    || MASTER_DSH_PLUGIN_PATTERN.test(name)
  ) {
    return 'master';
  }
  return 'unclassified';
}

export function resolveSessionNameForVisibility(input: {
  sessionName?: string | null;
  title?: string | null;
  subtitle?: string | null;
}): string {
  const explicit = input.sessionName?.trim();
  if (explicit) {
    return explicit;
  }
  const subtitle = input.subtitle?.trim() || '';
  const parts = subtitle.split(' · ');
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].replace(/\s+\([^)]*\)\s*$/, '').trim();
    if (last) {
      return last;
    }
  }
  return input.title?.trim() || '';
}

export function sessionMatchesDrawerVisibility(
  sessionClass: SessionDrawerVisibilityClass,
  mode: SessionDrawerVisibilityMode,
): boolean {
  if (mode === 'whitelist-master') {
    return sessionClass === 'master';
  }
  if (mode === 'blacklist-subagent') {
    return sessionClass !== 'subagent';
  }
  return true;
}

export function filterSessionsByDrawerVisibility<T>(
  sessions: readonly T[],
  mode: SessionDrawerVisibilityMode,
  resolveSessionName: (session: T) => string,
): T[] {
  if (mode === 'all') {
    return [...sessions];
  }
  return sessions.filter((session) => (
    sessionMatchesDrawerVisibility(
      classifySessionDrawerVisibility(resolveSessionName(session)),
      mode,
    )
  ));
}

export function nextSessionDrawerVisibilityMode(
  mode: SessionDrawerVisibilityMode,
): SessionDrawerVisibilityMode {
  const index = SESSION_DRAWER_VISIBILITY_MODES.indexOf(mode);
  return SESSION_DRAWER_VISIBILITY_MODES[(index + 1) % SESSION_DRAWER_VISIBILITY_MODES.length];
}

function isSessionDrawerVisibilityMode(value: string): value is SessionDrawerVisibilityMode {
  return (SESSION_DRAWER_VISIBILITY_MODES as readonly string[]).includes(value);
}

export function readSessionDrawerVisibilityMode(
  storage: SessionDrawerVisibilityStorage | null | undefined = typeof localStorage === 'undefined'
    ? null
    : localStorage,
): SessionDrawerVisibilityMode {
  if (!storage) {
    return DEFAULT_SESSION_DRAWER_VISIBILITY_MODE;
  }
  try {
    const raw = storage.getItem(SESSION_DRAWER_VISIBILITY_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SESSION_DRAWER_VISIBILITY_MODE;
    }
    const parsed = JSON.parse(raw) as { version?: number; mode?: unknown };
    if (parsed?.version !== 1 || typeof parsed.mode !== 'string' || !isSessionDrawerVisibilityMode(parsed.mode)) {
      return DEFAULT_SESSION_DRAWER_VISIBILITY_MODE;
    }
    return parsed.mode;
  } catch {
    return DEFAULT_SESSION_DRAWER_VISIBILITY_MODE;
  }
}

export function persistSessionDrawerVisibilityMode(
  mode: SessionDrawerVisibilityMode,
  storage: SessionDrawerVisibilityStorage | null | undefined = typeof localStorage === 'undefined'
    ? null
    : localStorage,
): SessionDrawerVisibilityMode {
  if (!storage) {
    return mode;
  }
  storage.setItem(SESSION_DRAWER_VISIBILITY_STORAGE_KEY, JSON.stringify({ version: 1, mode }));
  return mode;
}

export function useSessionDrawerVisibilityMode() {
  const [mode, setMode] = useState<SessionDrawerVisibilityMode>(() => readSessionDrawerVisibilityMode());
  const cycleVisibilityMode = useCallback(() => {
    setMode((current) => persistSessionDrawerVisibilityMode(nextSessionDrawerVisibilityMode(current)));
  }, []);
  return { mode, cycleVisibilityMode };
}
