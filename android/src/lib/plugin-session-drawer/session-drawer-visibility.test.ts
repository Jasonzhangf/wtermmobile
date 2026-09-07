// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  classifySessionDrawerVisibility,
  filterSessionsByDrawerVisibility,
  nextSessionDrawerVisibilityMode,
  persistSessionDrawerVisibilityMode,
  readSessionDrawerVisibilityMode,
  resolveSessionNameForVisibility,
  SESSION_DRAWER_VISIBILITY_STORAGE_KEY,
  sessionMatchesDrawerVisibility,
} from './session-drawer-visibility';

afterEach(() => {
  localStorage.removeItem(SESSION_DRAWER_VISIBILITY_STORAGE_KEY);
});

describe('session drawer visibility', () => {
  it('classifies hyphenated subagent names before master pane patterns', () => {
    expect(classifySessionDrawerVisibility('zterm-subagent-rw-ui-0906')).toBe('subagent');
    expect(classifySessionDrawerVisibility('claude-subagent-1')).toBe('subagent');
    expect(classifySessionDrawerVisibility('subagent')).toBe('subagent');
  });

  it('classifies collab master panes and the exact master name', () => {
    expect(classifySessionDrawerVisibility('master')).toBe('master');
    expect(classifySessionDrawerVisibility('zterm-2')).toBe('master');
    expect(classifySessionDrawerVisibility('zterm-12')).toBe('master');
    expect(classifySessionDrawerVisibility('dsh-plugins-3')).toBe('master');
  });

  it('leaves ordinary tmux names unclassified', () => {
    expect(classifySessionDrawerVisibility('OneStop-1')).toBe('unclassified');
    expect(classifySessionDrawerVisibility('zterm')).toBe('unclassified');
    expect(classifySessionDrawerVisibility('demo')).toBe('unclassified');
    expect(classifySessionDrawerVisibility('')).toBe('unclassified');
  });

  it('prefers explicit sessionName over custom title or subtitle', () => {
    expect(resolveSessionNameForVisibility({
      sessionName: 'zterm-2',
      title: 'my master',
      subtitle: 'studio · OneStop-1',
    })).toBe('zterm-2');
    expect(resolveSessionNameForVisibility({
      title: 'custom',
      subtitle: 'studio · zterm-subagent-a (herdr)',
    })).toBe('zterm-subagent-a');
  });

  it('whitelists only master and hides unclassified plus subagent', () => {
    expect(sessionMatchesDrawerVisibility('master', 'whitelist-master')).toBe(true);
    expect(sessionMatchesDrawerVisibility('subagent', 'whitelist-master')).toBe(false);
    expect(sessionMatchesDrawerVisibility('unclassified', 'whitelist-master')).toBe(false);
  });

  it('blacklists subagent while keeping master and unclassified', () => {
    expect(sessionMatchesDrawerVisibility('master', 'blacklist-subagent')).toBe(true);
    expect(sessionMatchesDrawerVisibility('unclassified', 'blacklist-subagent')).toBe(true);
    expect(sessionMatchesDrawerVisibility('subagent', 'blacklist-subagent')).toBe(false);
  });

  it('filters rows by reused session names without mutating the source list', () => {
    const sessions = [
      { id: 'm', sessionName: 'zterm-3' },
      { id: 's', sessionName: 'zterm-subagent-rw-ui-0906' },
      { id: 'u', sessionName: 'OneStop-1' },
    ];
    const source = [...sessions];
    expect(filterSessionsByDrawerVisibility(sessions, 'all', (row) => row.sessionName).map((row) => row.id))
      .toEqual(['m', 's', 'u']);
    expect(filterSessionsByDrawerVisibility(sessions, 'whitelist-master', (row) => row.sessionName).map((row) => row.id))
      .toEqual(['m']);
    expect(filterSessionsByDrawerVisibility(sessions, 'blacklist-subagent', (row) => row.sessionName).map((row) => row.id))
      .toEqual(['m', 'u']);
    expect(sessions).toEqual(source);
  });

  it('persists the client-local UI mode and ignores corrupt storage', () => {
    persistSessionDrawerVisibilityMode('whitelist-master');
    expect(readSessionDrawerVisibilityMode()).toBe('whitelist-master');
    localStorage.setItem(SESSION_DRAWER_VISIBILITY_STORAGE_KEY, '{bad');
    expect(readSessionDrawerVisibilityMode()).toBe('all');
    expect(nextSessionDrawerVisibilityMode('all')).toBe('whitelist-master');
    expect(nextSessionDrawerVisibilityMode('whitelist-master')).toBe('blacklist-subagent');
    expect(nextSessionDrawerVisibilityMode('blacklist-subagent')).toBe('all');
  });
});
