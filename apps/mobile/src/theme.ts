// ============================================================
// Mobile theme engine.
//
// THEME keeps its original shape (colors/radius/spacing/fonts) so the
// ~500 existing call sites keep working. Theming works by *mutating*
// THEME.colors in place via setAppTheme() and re-rendering from the
// root (App.tsx re-renders on theme state change; module-level
// StyleSheets are wrapped in themedSheet() so they rebuild too).
//
// This module is deliberately free of react-native imports so the
// palette logic stays unit-testable under vitest.
// ============================================================

export type ThemeMode = 'dark' | 'light';

export interface MobileThemeConfig {
  mode: ThemeMode;
  accent: string;
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const x = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(x.slice(0, 6), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Accent hex per mode: dark mode uses bright pastels (dark text on top),
// light mode uses deep inks (white text on top) — same hues as the web
// ACCENTS map in apps/web-dashboard/src/theme.ts.
export const ACCENTS: Record<string, { dark: string; light: string }> = {
  emerald: { dark: '#34d399', light: '#0ea271' },
  indigo:  { dark: '#8a93f8', light: '#4f46e5' },
  violet:  { dark: '#c184f9', light: '#9333ea' },
  azure:   { dark: '#56b8f5', light: '#0284c7' },
  amber:   { dark: '#fbbf24', light: '#b45309' },
  rose:    { dark: '#fb7185', light: '#e11d48' },
};

const DARK_COLORS = {
  bg: '#16161c',
  bgGradStart: '#1d1a29',
  surface: '#1f1f28',
  surface2: '#272733',
  surfaceHi: '#343444',
  line: 'rgba(255, 255, 255, 0.085)',
  line2: 'rgba(255, 255, 255, 0.14)',
  accent: '#34d399',
  accentSoft: 'rgba(52, 211, 153, 0.13)',
  accentLine: 'rgba(52, 211, 153, 0.32)',
  onAccent: '#0a0a0f',
  text: '#f7f7f9',
  text2: '#b8b8c2',
  text3: '#8c8c9e',
  pos: '#34d399',
  neg: '#f87171',
  warn: '#fbbf24',
  glassBg: 'rgba(31, 31, 40, 0.65)',
};

const LIGHT_COLORS = {
  bg: '#f4f3ee',
  bgGradStart: '#ebe8e1',
  surface: '#fffefb',
  surface2: '#f0eee7',
  surfaceHi: '#e6e3da',
  line: 'rgba(24, 24, 32, 0.10)',
  line2: 'rgba(24, 24, 32, 0.16)',
  accent: '#0ea271',
  accentSoft: 'rgba(14, 162, 113, 0.12)',
  accentLine: 'rgba(14, 162, 113, 0.30)',
  onAccent: '#ffffff',
  text: '#23222c',
  text2: '#5d5c68',
  text3: '#8b8a95',
  pos: '#0f9d6c',
  neg: '#d24848',
  warn: '#a06c00',
  glassBg: 'rgba(255, 255, 255, 0.70)',
};

export function buildColors(cfg: MobileThemeConfig): typeof DARK_COLORS {
  const base = cfg.mode === 'light' ? LIGHT_COLORS : DARK_COLORS;
  const accentHex = (ACCENTS[cfg.accent] || ACCENTS.emerald)[cfg.mode === 'light' ? 'light' : 'dark'];
  return {
    ...base,
    accent: accentHex,
    accentSoft: hexToRgba(accentHex, cfg.mode === 'light' ? 0.12 : 0.13),
    accentLine: hexToRgba(accentHex, cfg.mode === 'light' ? 0.30 : 0.32),
    onAccent: cfg.mode === 'light' ? '#ffffff' : '#0a0a0f',
  };
}

export const THEME = {
  colors: { ...DARK_COLORS },
  // StatusBar barStyle matching the current mode
  statusBarStyle: 'light-content' as 'light-content' | 'dark-content',
  radius: {
    xs: 4,
    sm: 8,
    regular: 12,
    lg: 16,
    xl: 22,
    pill: 999,
  },
  spacing: {
    gap: 16,
    gapLg: 22,
    pad: 20,
    padLg: 26,
  },
  fonts: {
    display: 'System',
    body: 'System',
    num: 'System',
  }
};

// ---- runtime switching ----
let currentConfig: MobileThemeConfig = { mode: 'dark', accent: 'emerald' };
let version = 0;
const listeners = new Set<() => void>();

export function getThemeConfig(): MobileThemeConfig { return currentConfig; }
export function getThemeVersion(): number { return version; }

/** Mutates THEME in place and notifies subscribers. Call *before* the
 *  triggering setState so the next render already sees the new colors. */
export function setAppTheme(cfg: MobileThemeConfig) {
  currentConfig = { mode: cfg.mode, accent: cfg.accent };
  Object.assign(THEME.colors, buildColors(currentConfig));
  THEME.statusBarStyle = cfg.mode === 'light' ? 'dark-content' : 'light-content';
  version++;
  listeners.forEach(l => l());
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Wraps a module-level StyleSheet factory so the sheet is rebuilt after a
 *  theme switch (plain `StyleSheet.create` captures colors at import time). */
export function themedSheet<T extends object>(factory: () => T): T {
  let cache = factory();
  let cachedVersion = version;
  return new Proxy(cache, {
    get(_, prop) {
      if (cachedVersion !== version) { cache = factory(); cachedVersion = version; }
      return (cache as any)[prop];
    },
  });
}

// ---- persistence (expo-secure-store, loaded lazily so this module stays
// importable outside React Native, e.g. in vitest) ----
const THEME_KEY = 'finvault_theme';

export async function persistThemeConfig(cfg: MobileThemeConfig & Record<string, unknown>) {
  try {
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(THEME_KEY, JSON.stringify(cfg));
  } catch { /* best effort */ }
}

export async function loadPersistedThemeConfig<T extends MobileThemeConfig>(): Promise<T | null> {
  try {
    const SecureStore = await import('expo-secure-store');
    const raw = await SecureStore.getItemAsync(THEME_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (cfg && (cfg.mode === 'dark' || cfg.mode === 'light') && typeof cfg.accent === 'string') return cfg as T;
  } catch { /* corrupt or unavailable */ }
  return null;
}
