# FinVault — CLAUDE.md

Fintech banking demo: Expo mobile app + Vite web dashboard + Node microservices.

## Repo layout

| Path | What it is |
|---|---|
| `apps/mobile` | Expo SDK 54 / RN 0.81 app (dark-only). `npm start` inside the folder, run via Expo Go. |
| `apps/web-dashboard` | Vite + React 18 SPA. `npm run dev` / `npm run build` (tsc + vite). |
| `services/gateway` | API gateway :8000 — proxies `/api/*`, WebSocket hub, event hub, rate limiting. |
| `services/account-service` | :8001 — auth (JWT + refresh), users, audit logs, Prisma. |
| `services/wallet-transaction-service` | :8002 — wallets, transactions, cards, goals, SEPA, ledger. |
| `services/invoice-service` | :8003 — invoices + PDF generation. |
| `shared/` | Shared TS: auth middleware, zod schemas, events, RabbitMQ, integrity hashing. |
| `docs/` | Project documentation (architecture, design system, security). |

## Conventions & gotchas

- **Workflow: small atomic commits.** One logical change per commit. Update this file's
  "Current work state" section and `TODO.md` *while* iterating, so progress survives a
  session/token cutoff.
- Mobile `money()` (apps/mobile/src/components/UI.tsx) formats nl-NL where `.` is the
  thousands separator — **never** strip decimals with string `.replace('.00','')`; use the
  `{ whole: true }` option. Web `money()` is en-US, so its `.replace` is safe.
- Mobile icons: `Icon.tsx` maps names → Feather glyphs, with a `MCI_MAPPING` fallback to
  MaterialCommunityIcons (e.g. `flame`, `faceId`). Unmapped names render help-circle —
  add a mapping when introducing a new icon name.
- Mobile motion primitives live in `src/components/Motion.tsx` (`PressableScale`,
  `FadeSlideIn`, `AnimatedProgressBar`) — all respect Reduce Motion. Use these instead of
  ad-hoc `Animated` code. Toasts: `src/components/Toast.tsx` via the `fire(title, body, type)`
  prop; `Alert.alert` only for destructive confirms.
- Mobile bottom sheets: `MobileSheet` (MobileExtras.tsx) — spring slide-up, drag-to-dismiss,
  keyboard-aware. Screens need `paddingBottom: 88` in scroll content to clear bottom nav.
- Mobile API base URL: `EXPO_PUBLIC_API_URL` env (falls back to a LAN IP in App.tsx).
- Demo/offline mode: log in with `admin@finvault.com` / `tom@finvault.com` when the
  backend is unreachable → `mock-token` session, all handlers fall back to local state.
- Backend services: JWT secret from `JWT_SECRET` env (shared/src/auth.ts has a dev
  fallback). Internal service-to-service calls use `X-Service-Secret` header.
- Expo SDK is **54** (`apps/mobile/AGENTS.md` mentions v56 docs — the installed SDK wins).

## Current work state (update while iterating!)

**Last updated:** 2026-06-10

**Done — branch `(ui/uix)-Rebase-of-UI`** (commit c522017):
- Full mobile UI/UX overhaul: money-formatter corruption fix, icon registry gaps,
  real clipboard copy (expo-clipboard), Motion.tsx + Toast.tsx, animated MobileSheet
  with drag-dismiss + keyboard avoidance, Android hardware-back handling, plan sheet
  i18n + contrast, settings switches, a11y labels/hitSlop/disabled states everywhere,
  card scheme fixes, analytics days-in-month fix (also web), Sparkline responsive width.

**In progress — branch `feature/security-and-session`:**
- [x] Backend: lock down `/users/profile-by-email` (X-Service-Secret) — commit 28873aa
- [x] Backend: hashed refresh tokens + `/auth/refresh` rotation + `/auth/logout` — b206134
- [x] Backend: generic login error, bcrypt 12, cleanup intervals — d1c7fa5
- [x] Backend: secret-fallback warnings (shared), gateway CORS allowlist — 974fdfb, 209dcd5
- [x] Root: `.env.example` — 209dcd5
- [ ] Mobile: persistent session via expo-secure-store (installed) + auto-login + refresh + revoke on logout  ← NEXT
- [ ] Mobile: Security activity (audit log) view in Settings
- [ ] Docs: `docs/` folder (architecture, design-system, security), keep TODO.md current
