# FinVault — CLAUDE.md

Fintech banking demo: Expo mobile app + Vite web dashboard + Node microservices.
This file is **context + rules only** — all tasks and progress live in [TODO.md](TODO.md).

---

## 1. Language policy

**Everything is written in English** so the project is uniform end to end:

- UI copy, labels, toasts, error messages (both apps)
- Code comments, identifiers, log output
- Documentation (`docs/`, README, this file), commit messages, PR titles/bodies, test names
- Exceptions: locale *data* stays authentic (`money()` formats nl-NL, seed addresses like
  "België", IBANs) — that's content, not interface language.
- Found a leftover Dutch string? Translate it as a small `fix(...)` cleanup commit when
  you're touching that area anyway.

## 2. Branch strategy — three tiers

```
feature/<topic>  →  dev  →  staging  →  main
```

| Branch | Purpose | Who merges into it |
|---|---|---|
| `feature/<topic>` | Active development — one logical topic per branch | You, via PR |
| `dev` | Integration — always CI-green, shared ground truth | PRs from feature branches |
| `staging` | Production preparation — env hardening, migration dry-run, smoke tests | PR from `dev` once a milestone is complete |
| `main` | Production — only ever updated from `staging` | PR from `staging` after sign-off |

**Rules:**
- A feature branch **never** targets `main` or `staging` directly.
- `staging` only receives merges from `dev` — never individual feature branches.
- `main` only receives merges from `staging` — never from `dev` or feature branches.
- A red CI on `dev` is everyone's problem — fix it before opening new PRs.

## 2a. The iteration loop (follow for every unit of work)

A "unit" = one function, feature, fix, or refactor — the smallest shippable slice.

1. **Pick** the next unticked item from the active branch group in TODO.md.
   No active group? Promote backlog items into a new `feature/<topic>` group first.
2. **Read context** before touching code: the codebase map below + the matching doc
   (§5). Don't rediscover what's already documented.
3. **Implement** the slice. Match surrounding style; reuse the shared primitives
   (Motion/Toast/Icon on mobile, tokens/`.btn`/`.field` on web, shared/ on backend).
4. **Test it** (§4): write or extend tests for new behavior, then run the targeted
   tests and typecheck the workspace(s) you touched.
5. **Document it** (§5): update the affected doc(s); new files or moved responsibilities
   also update the codebase map in this file.
6. **Tick TODO.md** for the item (add follow-up items you discovered to the backlog).
7. **Commit** — one small commit containing the code + tests + docs + TODO tick (§3).
8. **Push** — `git push` after every commit (set upstream on the first push). Work
   that only exists locally doesn't count as saved; the remote must always mirror
   progress so nothing is lost between sessions.
9. Repeat 1–8 until the branch group is fully ticked.

**Branch finish protocol** (after the last item on a feature branch):
1. Mirror CI locally from the repo root: `npm run build && npm test` — both must pass.
2. Push the final state and open a PR **targeting `dev`**: summary per commit, what was
   tested, link the relevant docs. Never open a PR with failing local checks.
3. CI is `.github/workflows/validate.yml` (install → prisma generate → shared build →
   workspace builds → `vitest run`) and runs on every PR. **A red PR is not done** —
   keep fixing (and pushing) on the branch until it's green.
4. After the feature PR merges into `dev` and CI is green: move the branch group in
   TODO.md to the Done section.

**Promoting `dev` → `staging` → `main`:**
1. Open a PR `dev → staging` only when a full milestone is complete and `dev` CI is
   green. Use the PR body to list: what changed, migrations needed, env var changes.
2. On `staging`: verify `.env` values for production, run `npm run build && npm test`,
   do a manual smoke test against a staging DB if available.
3. Open a PR `staging → main` only after step 2 is fully signed off.
4. After merging to `main`: tag the release (`git tag vX.Y.Z`) and push the tag.

## 3. Commit rules

- **One logical change per commit.** If the message needs "and", split it.
  Code + its tests + its docs + its TODO tick belong *together* in that commit.
- Never mix refactoring with behavior changes; never mix dependency bumps with code
  (deps get their own `chore(...)` commit, like expo-clipboard/secure-store did).
- Format: `type(scope): imperative summary` — body explains *why* when non-obvious.
  - **Types:** `feat` `fix` `docs` `chore` `refactor` `test` `ci`
  - **Scopes:** `mobile` `web` `gateway` `account` `wallet` `invoice` `shared` `security` `docs`
  - Examples from this repo's history:
    `fix(security): require X-Service-Secret on /users/profile-by-email`,
    `feat(mobile): persistent sessions via expo-secure-store`.
- Docs-only and test-only commits are fine (`docs:`/`test:` prefix).
- Before every commit: `npx tsc --noEmit` in each touched workspace
  (web: `npm run build` since that includes tsc). Don't commit red.

## 4. Testing rules

- Runner: **vitest**, colocated `*.test.ts` next to the source. Root `npm test` runs
  everything; `npx vitest run <file>` for a targeted run.
- Existing suites: `services/wallet-transaction-service/src/{ledger,sepa-validator}.test.ts`,
  `shared/src/events.test.ts`.
- **New backend logic ⇒ unit tests required** (validators, helpers, token logic).
  For endpoint tests, first refactor the service to export `app` without calling
  `listen()` (currently index.ts starts the server on import — known gap, see TODO).
- Pure helpers in `shared/` always get tests.
- Frontend changes: minimum bar is a clean typecheck of **both** apps when you touch a
  shared pattern (the apps mirror each other); add component tests when test infra for
  RN/React lands (not set up today — don't block on it, note it in TODO instead).
- Bug fixes: when feasible, write the test that would have caught the bug first.

## 5. Documentation rules — which doc owns what

| You changed… | Update |
|---|---|
| Services, endpoints, events, infra topology | [docs/architecture.md](docs/architecture.md) |
| Auth, sessions, secrets, rate limits, known gaps | [docs/security.md](docs/security.md) |
| Tokens, colors, typography, motion, components, a11y | [docs/design-system.md](docs/design-system.md) |
| New/moved/renamed files, new commands, new gotchas | **This file** (map in §7, gotchas in §8) |
| Setup / how-to-run instructions | README.md |
| Tasks, progress, follow-ups | [TODO.md](TODO.md) — and *only* there |

Rule of thumb: if a future session would have to read source code to learn it, it
belongs in a doc. Keep docs truthful — delete claims that stopped being true.

## 6. Commands

| What | Command (repo root) |
|---|---|
| Everything (services + web) | `npm run dev` (kills busy ports first) |
| Everything + mobile | `npm run dev:all` |
| One service | `npm run dev:gateway` / `dev:account` / `dev:wallet` / `dev:invoice` |
| Web only / Mobile only | `npm run dev:web` / `npm run dev:mobile` (Expo Go) |
| Build all workspaces | `npm run build` (mobile has no build script — skipped) |
| All tests | `npm test` (= `vitest run`, picks up `*.test.ts` everywhere) |
| Targeted tests | `npx vitest run path/to/file.test.ts` |
| Typecheck one app | `npx tsc --noEmit` inside that workspace |
| Docker stack | `docker-compose up` (RabbitMQ + gateway + 3 services) |
| CI mirror | `npm run build && npm test` |

Demo logins: `admin@finvault.com` / `test@finvault.com` (seeded backend accounts), or
the same emails offline → client-side mock demo mode. Mobile API base: `EXPO_PUBLIC_API_URL`.

## 7. Codebase map — where is what

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
| `wallet-transaction-service` :8002 | `/wallets` (+deposit/history/credit-line/simulate-time), `/transactions` (+transfer/own-transfer/sepa-transfer/internal-transfer), `/cards` (+freeze/limit), `/goals` (+fund, PUT/DELETE), `walletLabel()`, webhook consumer, seed self-healing. Tests: `ledger.test.ts`, `sepa-validator.test.ts` |
| `invoice-service` :8003 | Invoices, payment requests, mandates, `pdf-generator.ts` |

### shared/ (rebuild after edits: `npm run build --workspace=shared`!)
`auth.ts` (JWT_SECRET/SERVICE_SECRET + warnings, `verifyToken`, `requireAuth`,
`requireServiceSecret`) · `validation.ts` (zod schemas + `validateBody`) ·
`events.ts`/`rabbitmq.ts` (event envelopes, topic exchange + DLQ) ·
`integrity.ts` (HMAC tx hashing) · `types.ts`.

## 8. Conventions & gotchas

- Both frontends implement the same screens in parallel — a change in one usually
  needs a sibling change in the other.
- **Mobile money():** nl-NL, `.` = thousands separator → `money(x,'EUR',{whole:true})`
  for round amounts. **Web money():** en-US, `.replace('.00','')` is safe there.
- Mobile is **state-routed** (no nav lib): `setRoute('cards')`, `route === 'account:<id>'`.
- `shared/` is consumed from `dist/` — rebuild it or service imports go stale.
- Wallet model has **no `name` column**; display names derive from `type`
  (`walletLabel()` server-side, inline ternaries client-side).
- Services run on Node ESM + tsx; Prisma clients are generated into `generated/prisma`.
- Mobile screens need `paddingBottom: 88` in scroll content to clear the bottom nav.
- Alerts (`Alert.alert`) only for destructive confirmations — all other feedback via toasts.
- Expo SDK is **54** (`apps/mobile/AGENTS.md` mentions v56 docs — installed SDK wins).
