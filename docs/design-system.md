# FinVault Design System

Dark-first fintech look: emerald accent, soft-radius surfaces, spring-physics motion.

## Tokens

### Color (dark, default)
| Token | Mobile (`THEME.colors`) | Web (CSS var) | Use |
|---|---|---|---|
| Background | `#16161c` | `--bg` (oklch 0.165) | App canvas |
| Surface | `#1f1f28` | `--surface` | Cards |
| Surface 2 | `#272733` | `--surface-2` | Inputs, nested chips |
| Surface hi | `#343444` | `--surface-hi` | Progress tracks, hover |
| Line | `rgba(255,255,255,.085)` | `--line` | Hairline borders |
| Accent | `#34d399` | `--accent` (oklch h158) | Primary actions, positive |
| On-accent | `#0a0a0f` | `--on-accent` | Text on accent fills |
| Text / 2 / 3 | `#f7f7f9 / #b8b8c2 / #8c8c9e` | `--text/-2/-3` | Hierarchy |
| Negative | `#f87171` | `--neg` | Outflows, destructive |
| Warn | `#fbbf24` | `--warn` | Caution states |

Wallet-type accents (both apps): checking = emerald, savings = `#a78bfa` (violet),
travel = `#38bdf8` (sky).

- Web colors are **OKLCH** and derive accent variants from `--accent-h/c/l`.
- Web supports light mode + 6 accent presets + radius/density/card variants via
  `data-*` attributes on `<html>` (see `Tweaks.tsx`). Mobile is dark-only for now.

### Typography
- Web: **Space Grotesk** (display + numerals, `.display`/`.num` with tabular figures),
  **Hanken Grotesque** (body). Alternate presets: Bricolage Grotesque, Instrument
  Serif, JetBrains Mono.
- Mobile: system font; monospace (`Menlo`/`monospace`) for stat numerals.
- Numbers in data contexts always use tabular figures to avoid layout shift.

### Radius & spacing
- Mobile `THEME.radius`: xs 4 · sm 8 · regular 12 · lg 16 · xl 22 · pill 999.
- 4/8-pt spacing rhythm; screens use 16px padding, 88px bottom padding to clear nav.

## Motion

One rhythm everywhere — spring physics, enter slower than exit, reduced-motion aware.

| Pattern | Mobile | Web |
|---|---|---|
| Press feedback | `PressableScale` (spring to 0.91–0.95) | `.btn:active`, `.qaction:active` scale |
| Entrance | `FadeSlideIn` (springs, 40–80ms stagger steps) | `.rise`/`.rise-d1…d6`, `.page-enter` |
| Progress | `AnimatedProgressBar` (spring translateX) | CSS `transition: width .6s ease` |
| Sheets/modals | `MobileSheet`: spring slide-up, fading scrim, drag-to-dismiss | `fvSheetUp` keyframes |
| Feedback | `Toast.tsx` — slide-down, auto-dismiss 3.5s | `Toast` in `UI.tsx` |
| Reduced motion | `useReducedMotion()` (AccessibilityInfo) skips all of the above | `prefers-reduced-motion` kill-switch in `index.css` |

Rules of thumb: micro-interactions 150–300 ms; animate transform/opacity only;
1–2 animated elements per view; exits ≈60% of enter duration.

## Components (mobile)

- **Icon** (`Icon.tsx`) — semantic name → Feather glyph; `MCI_MAPPING` for gaps
  (`flame`, `faceId`). *Never* use emoji/unicode glyphs as icons.
- **Motion** (`Motion.tsx`) — `PressableScale`, `FadeSlideIn`, `AnimatedProgressBar`.
- **Toast** (`Toast.tsx`) — `useToasts()` + `<ToastHost/>`; `fire(title, body, type)`
  with type ∈ success/info/warn/error. Alerts only for destructive confirmations.
- **MobileSheet** (`MobileExtras.tsx`) — bottom sheet with drag handle; content is
  keyboard-aware and scrollable. Variants: card detail (auto-hides sensitive data on
  close), limits, plan upgrade, top-up, goal sheets.
- **BankCard** — scheme map (`metal/cyan/violet/gold/accent`); exported as
  `CARD_SCHEMES` for pickers.
- **UI.tsx** — `money()` (nl-NL; `{ whole: true }` for round amounts — never string-strip),
  `Ring`, `Donut`, `Sparkline` (measures its container), `Bars`, `CategoryIcon`, `Delta`.

## Accessibility checklist

- Touch targets ≥44 pt (hitSlop where the visual is smaller).
- Every icon-only control has `accessibilityLabel`; selectable items expose
  `accessibilityState`; filters/tabs use the `tab` role.
- Disabled states: 0.5 opacity + `accessibilityState.disabled`.
- Progress bars expose `accessibilityValue`; toasts use polite live regions.
- Color is never the only signal (badges pair icon/text with color).
