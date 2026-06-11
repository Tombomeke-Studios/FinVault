import { describe, it, expect, afterEach } from 'vitest';
import {
  THEME, ACCENTS, hexToRgba, buildColors, setAppTheme, getThemeConfig,
  getThemeVersion, subscribeTheme, themedSheet,
} from './theme';

// The engine mutates the shared THEME singleton — restore dark/emerald
// after each test so order doesn't matter.
afterEach(() => setAppTheme({ mode: 'dark', accent: 'emerald' }));

describe('hexToRgba', () => {
  it('expands 6-digit hex with alpha', () => {
    expect(hexToRgba('#34d399', 0.13)).toBe('rgba(52, 211, 153, 0.13)');
  });
  it('supports 3-digit shorthand', () => {
    expect(hexToRgba('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });
});

describe('buildColors', () => {
  it('uses the light accent variant and white on-accent in light mode', () => {
    const c = buildColors({ mode: 'light', accent: 'amber' });
    expect(c.accent).toBe(ACCENTS.amber.light);
    expect(c.onAccent).toBe('#ffffff');
    expect(c.bg).not.toBe(buildColors({ mode: 'dark', accent: 'amber' }).bg);
  });
  it('falls back to emerald for unknown accents', () => {
    const c = buildColors({ mode: 'dark', accent: 'nope' });
    expect(c.accent).toBe(ACCENTS.emerald.dark);
  });
  it('derives accentSoft/accentLine from the accent hex', () => {
    const c = buildColors({ mode: 'dark', accent: 'rose' });
    expect(c.accentSoft).toBe(hexToRgba(ACCENTS.rose.dark, 0.13));
    expect(c.accentLine).toBe(hexToRgba(ACCENTS.rose.dark, 0.32));
  });
});

describe('setAppTheme', () => {
  it('mutates THEME in place and flips the status bar style', () => {
    setAppTheme({ mode: 'light', accent: 'indigo' });
    expect(THEME.colors.accent).toBe(ACCENTS.indigo.light);
    expect(THEME.colors.text).toBe('#23222c');
    expect(THEME.statusBarStyle).toBe('dark-content');
    expect(getThemeConfig()).toEqual({ mode: 'light', accent: 'indigo' });
  });
  it('bumps the version and notifies subscribers', () => {
    const before = getThemeVersion();
    let calls = 0;
    const unsub = subscribeTheme(() => { calls++; });
    setAppTheme({ mode: 'dark', accent: 'violet' });
    expect(getThemeVersion()).toBe(before + 1);
    expect(calls).toBe(1);
    unsub();
    setAppTheme({ mode: 'dark', accent: 'azure' });
    expect(calls).toBe(1);
  });
});

describe('themedSheet', () => {
  it('rebuilds the sheet after a theme switch', () => {
    const sheet = themedSheet(() => ({ row: { color: THEME.colors.accent } }));
    const darkAccent = sheet.row.color;
    setAppTheme({ mode: 'light', accent: 'emerald' });
    expect(sheet.row.color).toBe(ACCENTS.emerald.light);
    expect(sheet.row.color).not.toBe(darkAccent);
  });
  it('caches between switches', () => {
    let builds = 0;
    const sheet = themedSheet(() => { builds++; return { a: 1 }; });
    void sheet.a; void sheet.a;
    expect(builds).toBe(1);
    setAppTheme({ mode: 'light', accent: 'emerald' });
    void sheet.a; void sheet.a;
    expect(builds).toBe(2);
  });
});
