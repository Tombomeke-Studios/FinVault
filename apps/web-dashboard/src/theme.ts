// ============================================================
// FinVault theme engine — single source of truth.
// The token sheet lives in index.css; this module owns the
// JS side: accent/font/preset maps, applying a ThemeConfig to
// <html>, and persisting the user's choice.
// ============================================================

export interface ThemeConfig {
  mode: 'dark' | 'light';
  accent: string;
  font: string;
  radius: string;
  density: string;
  card: string;
}

export const FONTS: Record<string, { display: string; body: string; num: string; label: string }> = {
  grotesk:   { display: "'Space Grotesk'", body: "'Hanken Grotesque'", num: "'Space Grotesk'", label: 'Grotesk' },
  bricolage: { display: "'Bricolage Grotesque'", body: "'Hanken Grotesque'", num: "'Space Grotesk'", label: 'Display' },
  editorial: { display: "'Instrument Serif'", body: "'Hanken Grotesque'", num: "'Space Grotesk'", label: 'Editorial' },
  mono:      { display: "'JetBrains Mono'", body: "'JetBrains Mono'", num: "'JetBrains Mono'", label: 'Mono' },
};

// h/c/l feed the OKLCH accent derivations in index.css; `on` is the text
// color on accent fills; `sw` is the flat swatch shown in pickers.
export const ACCENTS: Record<string, { h: number; c: number; l: number; on: string; sw: string }> = {
  emerald: { h: 158, c: 0.13, l: 0.62, on: 'oklch(0.99 0 0)', sw: 'oklch(0.62 0.13 158)' },
  indigo:  { h: 265, c: 0.15, l: 0.56, on: 'oklch(0.99 0 0)', sw: 'oklch(0.56 0.15 265)' },
  violet:  { h: 305, c: 0.16, l: 0.58, on: 'oklch(0.99 0 0)', sw: 'oklch(0.58 0.16 305)' },
  azure:   { h: 232, c: 0.14, l: 0.60, on: 'oklch(0.99 0 0)', sw: 'oklch(0.60 0.14 232)' },
  amber:   { h: 75,  c: 0.13, l: 0.74, on: 'oklch(0.24 0.03 80)', sw: 'oklch(0.74 0.13 75)' },
  rose:    { h: 12,  c: 0.16, l: 0.62, on: 'oklch(0.99 0 0)', sw: 'oklch(0.62 0.16 12)' },
};

export const PRESETS: Record<string, ThemeConfig> = {
  Vault:    { mode: 'dark',  accent: 'emerald', font: 'grotesk',   radius: 'soft',  density: 'regular', card: 'elevated' },
  Daylight: { mode: 'light', accent: 'indigo',  font: 'grotesk',   radius: 'soft',  density: 'regular', card: 'outline' },
  Aurora:   { mode: 'dark',  accent: 'violet',  font: 'bricolage', radius: 'round', density: 'comfy',   card: 'glass' },
  Carbon:   { mode: 'dark',  accent: 'azure',   font: 'mono',      radius: 'sharp', density: 'compact', card: 'outline' },
  Sand:     { mode: 'light', accent: 'amber',   font: 'editorial', radius: 'round', density: 'comfy',   card: 'elevated' },
  Midnight: { mode: 'dark',  accent: 'rose',    font: 'grotesk',   radius: 'round', density: 'regular', card: 'glass' },
  Mint:     { mode: 'light', accent: 'emerald', font: 'grotesk',   radius: 'soft',  density: 'regular', card: 'elevated' },
};

export const DEFAULT_THEME: ThemeConfig = PRESETS.Vault;

const STORAGE_KEY = 'fv_theme';

export function applyTheme(t: ThemeConfig) {
  const el = document.documentElement;
  el.setAttribute('data-mode',    t.mode);
  el.setAttribute('data-radius',  t.radius);
  el.setAttribute('data-density', t.density);
  el.setAttribute('data-card',    t.card);
  const a = ACCENTS[t.accent] || ACCENTS.emerald;
  el.style.setProperty('--accent-h', String(a.h));
  el.style.setProperty('--accent-c', String(a.c));
  el.style.setProperty('--accent-l', String(a.l));
  el.style.setProperty('--on-accent', a.on);

  const f = FONTS[t.font] || FONTS.grotesk;
  const dispFb = t.font === 'editorial' ? ', Georgia, serif' : t.font === 'mono' ? ', ui-monospace, monospace' : ', system-ui, sans-serif';
  const bodyFb = t.font === 'mono' ? ', ui-monospace, monospace' : ', system-ui, sans-serif';
  el.style.setProperty('--font-display', f.display + dispFb);
  el.style.setProperty('--font-body',    f.body + bodyFb);
  el.style.setProperty('--font-num',     f.num + (t.font === 'mono' ? ', ui-monospace, monospace' : ', system-ui, sans-serif'));

  // Cross-fade colors when the theme changes at runtime (class is set after
  // first paint so the initial load doesn't animate). Removed on a timer so
  // it never lingers on hover/press transitions.
  if (el.dataset.themeReady) {
    el.classList.add('theme-anim');
    window.clearTimeout(themeAnimTimer);
    themeAnimTimer = window.setTimeout(() => el.classList.remove('theme-anim'), 400);
  } else {
    el.dataset.themeReady = '1';
  }
}

let themeAnimTimer = 0;

export function saveTheme(t: ThemeConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch { /* private mode */ }
}

export function loadTheme(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const t = JSON.parse(raw);
    if (t && (t.mode === 'dark' || t.mode === 'light') && typeof t.accent === 'string'
      && typeof t.font === 'string' && typeof t.radius === 'string'
      && typeof t.density === 'string' && typeof t.card === 'string') {
      return t as ThemeConfig;
    }
  } catch { /* corrupt value — fall through */ }
  return DEFAULT_THEME;
}
