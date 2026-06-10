# FinVault — CLAUDE.md

Fintech banking demo: Expo mobile app + Vite web dashboard + Node microservices.
This file is **context + rules only** — all tasks/progress live in [TODO.md](TODO.md).

## Workflow rules (mandatory)

1. **One unit of work = one small commit.** Every added function/feature/fix is its own
   commit. Before moving to the next unit, the same commit (or an immediate follow-up)
   must include: the **TODO.md update**, the **documentation** (docs/ and/or this file),
   and **tests** for the new behavior. Only then continue.
2. **No to-dos in CLAUDE.md.** TODO.md is the single source of truth for tasks and
   progress. Tasks are grouped per branch there; pick up a branch group, finish it.
3. **Branch done → PR → CI green.** When all TODO items for a branch are checked, push
   and open a PR. CI is `.github/workflows/validate.yml` (install → prisma generate →
   `npm run build --workspace=shared` → `npm run build` → `npm test`). If CI fails,
   keep fixing on the branch until the PR is green — a red PR is not done.
   Mirror CI locally before pushing: `npm run build && npm test` from the repo root.
4. **Read the docs first.** Before touching an area, check the matching doc:
   [docs/architecture.md](docs/architecture.md) (services, endpoints, event flow),
   [docs/security.md](docs/security.md) (auth/session model, known gaps),
   [docs/design-system.md](docs/design-system.md) (tokens, motion, components, a11y).
   When behavior changes, update the doc in the same unit of work.

## Commands

| What | Command (repo root) |
|---|---|
| Everything (services + web) | `npm run dev` (kills busy ports first) |
| Everything + mobile | `npm run dev:all` |
| One service | `npm run dev:gateway` / `dev:account` / `dev:wallet` / `dev:invoice` |
| Web only / Mobile only | `npm run dev:web` / `npm run dev:mobile` (Expo Go) |
| Build all workspaces | `npm run build` (mobile has no build script — skipped) |
| All tests | `npm test` (= `vitest run`, picks up `*.test.ts` everywhere) |
| Typecheck one app | `npx tsc --noEmit` inside that workspace |
| Docker stack | `docker-compose up` (RabbitMQ + gateway + 3 services) |

Demo logins: `admin@finvault.com` / `test@finvault.com` (backend, password in seed)
or the same emails offline → mock demo mode. Mobile API base: `EXPO_PUBLIC_API_URL`.

## Codebase map — where is what

### apps/mobile (Expo SDK 54, RN 0.81, dark-only)
| File | Contents |
|---|---|
| `App.tsx` | All app state: auth/token, wallets/transactions/cards/goals, route string (`'overview'`, `'account:<walletId>'`, …), all API handlers (`handleLogin/Transfer/Deposit/OwnTransfer/UpgradePlan`), mock-data builder, deposit + plan-upgrade sheets, Android BackHandler, session restore + splash |
| `src/session.ts` | SecureStore token persistence: `saveSession/loadSession/clearSession/tryRefreshSession/revokeSession` |
| `src/theme.ts` | `THEME` tokens (colors/radius/spacing) — hex, single dark palette |
| `src/components/Icon.tsx` | Name → Feather glyph map + `MCI_MAPPING` (MaterialCommunityIcons fallback: `flame`, `faceId`). Unmapped → help-circle |
| `src/components/Motion.tsx` | `PressableScale`, `FadeSlideIn`, `AnimatedProgressBar`, `useReducedMotion` — use these, no ad-hoc Animated code |
| `src/components/Toast.tsx` | `useToasts()` + `<ToastHost/>`; `fire(title, body, type)` success/info/warn/error |
| `src/components/MobileExtras.tsx` | `MobileSheet` (bottom sheet: spring, drag-dismiss, keyboard-aware), `MobileCardDetail` (reveal + clipboard copy), `LimitsSheet` |
| `src/components/BankCard.tsx` | Card visual; `CARD_SCHEMES` (metal/cyan/violet/gold/accent) |
| `src/components/UI.tsx` | `money()` (nl-NL! use `{whole:true}`, never string-strip), `relTime`, `Ring`, `Donut`, `Sparkline`, `Bars`, `CategoryIcon`, `Delta`, `Avatar` |
| `src/components/Shell.tsx` | Top bar (logo + avatar→settings) + bottom nav (5 items, center Send FAB) |
| `src/screens/` | One file per screen: Overview, Transactions, Transfer, Cards, Savings, Analytics, Settings (incl. Security-activity sheet), Auth, AccountDashboard (`account:<id>` route) |

### apps/web-dashboard (Vite + React 18 + React Router)
| File | Contents |
|---|---|
| `src/App.tsx` | Routing (PATH_TO_ROUTE), theming engine (`applyTheme`, ACCENTS/FONTS/PRESETS), auth with localStorage token, data fetching, mock fallback |
| `src/index.css` | The only CSS entry: OKLCH tokens per `data-mode/radius/density/card`, `.btn/.field/.chip/.card`, all `fv*` keyframes, reduced-motion kill-switch |
| `src/components/` | `Shell` (sidebar/bottom-nav via `compact` prop), `UI` (money en-US, Toast, Sheet), `Icon`/`Icons` (SVG path registry), `BankCard` + `SwipeableCards`, `IOSFrame` (device mockup), `Tweaks` (theme panel), `Logo` |
| `src/screens/` | Same screen set as mobile + `ScreenLanding` |

### services (Express + Prisma/SQLite each, ESM)
| Service | Key routes (src/index.ts) |
|---|---|
| `gateway` :8000 | `/api/*` proxy map, per-IP rate limit, CORS allowlist (`CORS_ORIGINS`), WebSocket hub (`?token=JWT`), Event Hub `POST /api/events/publish` (X-Service-Secret) |
| `account-service` :8001 | `/auth/register|login|refresh|logout`, `/users/profile`, `/users/plan`, `/users/audit-logs`, internal `/users/profile-by-email` (X-Service-Secret), `issueTokenPair()` + sha256 `hashToken()`, lockout + rate limits, `seedAccounts()` |
| `wallet-transaction-service` :8002 | `/wallets` (+deposit/history/credit-line/simulate-time), `/transactions` (+transfer/own-transfer/sepa-transfer/internal-transfer), `/cards` (+freeze/limit), `/goals` (+fund, PUT/DELETE), `walletLabel()`, webhook consumer, seed self-healing. Tests: `ledger.test.ts`, `sepa-validator.test.ts` (vitest) |
| `invoice-service` :8003 | Invoices, payment requests, mandates, `pdf-generator.ts` |

### shared/ (build with `npm run build --workspace=shared` after edits!)
`auth.ts` (JWT_SECRET/SERVICE_SECRET + warnings, `verifyToken`, `requireAuth`,
`requireServiceSecret`) · `validation.ts` (zod schemas + `validateBody`) ·
`events.ts`/`rabbitmq.ts` (event envelopes, topic exchange + DLQ) ·
`integrity.ts` (HMAC tx hashing) · `types.ts`.

## Conventions & gotchas

- Both frontends implement the same screens in parallel — a change in one usually
  needs a sibling change in the other.
- **Mobile money():** nl-NL, `.` = thousands separator → `money(x,'EUR',{whole:true})`
  for round amounts. **Web money():** en-US, `.replace('.00','')` is safe there.
- Mobile is **state-routed** (no nav lib): `setRoute('cards')`, `route === 'account:<id>'`.
- `shared/` is consumed from `dist/` — rebuild it or service imports go stale.
- Wallet model has **no `name` column**; display names derive from `type`
  (`walletLabel()` server-side, inline ternaries client-side).
- Services run on Node ESM + tsx; Prisma clients are generated into `generated/prisma`.
- Expo SDK is **54** (`apps/mobile/AGENTS.md` mentions v56 docs — installed SDK wins).
- Commit messages: conventional prefixes (`feat/fix/docs/chore(scope): …`).
