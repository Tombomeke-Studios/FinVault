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
- The GitHub **default branch is `dev`** (since 2026-06-12): new PRs target it by
  default, fresh clones check it out, and issue auto-close fires on merges into it.
  This changes nothing about the release flow above — `main` stays the production tier.

## 2a. GitHub issues — every task is a trackable issue

Tasks live in two places that must stay in sync:

- **TODO.md** — the working checklist, grouped per branch (single source of truth for *progress*)
- **GitHub issues** — the trackable mirror of every open TODO item (single source of truth for *linking*: PRs, commits, discussion)

**Trigger table — when X happens, the agent does Y, immediately and unprompted:**

| Moment | Action |
|---|---|
| You add an actionable item to TODO.md | Create its GitHub issue (rule 1) and put the `(#N)` ref on the TODO line |
| You promote a backlog group to `feature/<topic>` | Verify every item in it has an issue; create any missing ones first |
| You discover a bug while working | Issue immediately (`type:bug`), then decide: fix now or backlog |
| You open a PR | One `Closes #N` line per completed issue in the PR body |
| The PR merges | Verify the issues auto-closed; move the group to Done in TODO.md; `git fetch --prune` (GitHub deletes the head branch automatically) |

**Rules:**

1. **Every actionable TODO item gets a GitHub issue** — at the latest when its backlog
   group is promoted to an active `feature/<topic>` group; bugs get one immediately.
   Create with `gh issue create --title "..." --body "..." --label scope:<x> --label type:<y>`.
2. **Title** = the TODO line, imperative. **Body** = context, acceptance criteria,
   affected files, links to the relevant doc (§5).
3. **Labels:** one `scope:*` label (mobile/web/gateway/account/wallet/invoice/shared/
   security/docs/ci) + one `type:*` label (bug/feature/refactor/test/docs). Keep the
   label set in sync with the commit scopes in §3.
4. **TODO.md items carry their issue ref:** `- [ ] Fix X (#12)` — add the ref the
   moment the issue exists.
5. **PR bodies close their issues:** list every completed issue as `Closes #N` (one per
   line) in the PR description. GitHub closes them natively when the PR merges —
   auto-close fires on default-branch merges, and the default branch is `dev` (§2).
   The issue's Development sidebar shows the linked PR automatically.
6. An issue is only ever closed by a merged PR — or manually with a comment explaining
   why (duplicate, obsolete, won't fix). Never silently.
7. Open issues are the **backlog**, not a failure signal: an issue stays open until its
   feature branch ships. Don't close issues to "clean up" — close them by shipping.

## 2b. The iteration loop (follow for every unit of work)

A "unit" = one function, feature, fix, or refactor — the smallest shippable slice.

1. **Pick** the next unticked item from the active branch group in TODO.md.
   No active group? Promote backlog items into a new `feature/<topic>` group first —
   and create the GitHub issues for them (§2a) as part of that promotion.
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
   tested, link the relevant docs, and a `Closes #N` line per completed issue (§2a).
   Never open a PR with failing local checks.
3. CI is `.github/workflows/validate.yml` (install → prisma generate → shared build →
   workspace builds → `vitest run`) and runs on every PR — see [docs/ci-cd.md](docs/ci-cd.md)
   for the full pipeline reference and how to maintain the workflow files.
   **A red PR is not done** — keep fixing (and pushing) on the branch until it's green.
4. After the feature PR merges into `dev` and CI is green: move the branch group in
   TODO.md to the Done section and verify the linked issues were auto-closed.
5. The remote head branch is deleted automatically on merge (repo setting
   *Automatically delete head branches*). Locally run `git fetch --prune` and
   `git branch -d feature/<topic>` — merged branches never linger.

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
| Anything under `.github/workflows/` (triggers, steps, pinned actions) | [docs/ci-cd.md](docs/ci-cd.md) |
| Product feature set vs. real banking apps (gaps, priorities) | [docs/feature-roadmap.md](docs/feature-roadmap.md) |
| EAS Build/Submit/Update, VM hosting, Play Store, deployment options | [docs/deployment-strategy.md](docs/deployment-strategy.md) |
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

### apps/mobile (Expo SDK 54, RN 0.81, themed dark/light)
| File | Contents |
|---|---|
| `App.tsx` | All app state: auth/token, wallets/transactions/cards/goals, route string (`'overview'`, `'account:<walletId>'`, …), all API handlers (`handleLogin/Transfer/Deposit/OwnTransfer/UpgradePlan`), mock-data builder, deposit + plan-upgrade sheets, Android BackHandler, session restore + splash. `ErrorBoundary` class wraps the root to catch render-time crashes in production builds |
| `index.ts` | Entry point: `registerRootComponent` + global `ErrorUtils` handler for async crashes in standalone builds |
| `app.json` | Expo config: `android.package` (`com.tombomekestudio.finvault`), `versionCode`, `owner` (tombomekestudios), EAS `projectId`, plugins (`expo-local-authentication` + `expo-secure-store` + `expo-camera`) — all three plugins are required; missing one = instant crash |
| `babel.config.js` | **Required for standalone builds** — `babel-preset-expo`; Expo Go provides this implicitly but EAS-built APKs crash without it |
| `eas.json` | EAS Build profiles: `development` (dev-client APK), `preview` (sideloadable APK), `production` (signed AAB for Play Store); all profiles set `EXPO_USE_METRO_WORKSPACE_ROOT=1` for monorepo support |
| `metro.config.js` | **Critical for monorepo** — sets `watchFolders` to monorepo root and `nodeModulesPaths` to both workspace + root `node_modules`; without this, hoisted native packages are not compiled in and the standalone APK crashes instantly |
| `src/session.ts` | SecureStore token persistence: `saveSession/loadSession/clearSession/tryRefreshSession/revokeSession` |
| `src/biometrics.ts` | Real biometric gate (expo-local-authentication): `isBiometricAvailable/authenticateBiometric` + keystore-persisted opt-in pref |
| `src/theme.ts` | Theme engine: mutable `THEME` tokens (hex), dark/light palettes × 6 accents, `setAppTheme`/`subscribeTheme`, `themedSheet` StyleSheet proxy, secure-store persistence. Tests: `theme.test.ts` |
| `src/components/Icon.tsx` | Name → Feather glyph map + `MCI_MAPPING` (MaterialCommunityIcons fallback: `flame`, `faceId`). Unmapped → help-circle |
| `src/components/Motion.tsx` | `PressableScale`, `FadeSlideIn`, `AnimatedProgressBar`, `useReducedMotion` — use these, no ad-hoc Animated code |
| `src/components/Toast.tsx` | `useToasts()` + `<ToastHost/>`; `fire(title, body, type)` success/info/warn/error |
| `src/components/MobileExtras.tsx` | `MobileSheet` (bottom sheet: spring, drag-dismiss, keyboard-aware), `MobileCardDetail` (reveal + clipboard copy), `LimitsSheet` |
| `src/components/QrScanSheet.tsx` | Scan-to-pay sheet: expo-camera + permission flow, accepts EPC069-12 SEPA QR only |
| `src/lib/` | `epc.ts` (EPC QR build/parse), `validate.ts` (email/IBAN), `csv.ts` (export) — all unit-tested |
| `src/components/BankCard.tsx` | Card visual; `CARD_SCHEMES` (metal/cyan/violet/gold/accent) |
| `src/components/UI.tsx` | `money()` (nl-NL! use `{whole:true}`, never string-strip), `relTime`, `Ring`, `Donut`, `Sparkline`, `Bars`, `CategoryIcon`, `Delta`, `Avatar` |
| `src/components/Shell.tsx` | Top bar (logo + avatar→settings) + bottom nav (5 items, center Send FAB) |
| `src/screens/` | One file per screen: Overview, Transactions, Transfer, Cards, Savings, Analytics, Settings (incl. Security-activity sheet), Auth, AccountDashboard (`account:<id>` route) |

### apps/web-dashboard (Vite + React 18 + React Router)
| File | Contents |
|---|---|
| `src/App.tsx` | Routing (PATH_TO_ROUTE), auth (in-memory access token, boot restore + silent refresh via `lib/session.ts`), data fetching, mock fallback; re-exports `ThemeConfig` |
| `src/lib/` | `session.ts` (refresh-token persistence/rotation/revocation, mirrors mobile), `validate.ts` (email/IBAN recipient checks), `csv.ts` (transaction export), `epc.ts` (EPC QR build/parse, mirrors mobile) — all unit-tested |
| `src/theme.ts` | Theme engine: `ThemeConfig`, `ACCENTS`/`FONTS`/`PRESETS`, `applyTheme()` (data-attrs + accent vars on `<html>`, runtime cross-fade), `loadTheme()`/`saveTheme()` persistence (localStorage `fv_theme`) |
| `src/index.css` | The only CSS entry — 7 layers with a token-contract header: primitives → mode palettes → style axes (`data-mode/radius/density/card`) → base → components (`.btn/.field/.chip/.card/.nav-item`) → motion (`fv*` keyframes + utilities, `.stagger`, theme cross-fade) → reduced-motion kill-switch. Accent-as-text uses `--accent-ink`, category hues use `--cat-l`/`--cat-soft-a` |
| `src/components/` | `Shell` (sidebar/bottom-nav via `compact` prop; `FVLogo` theme-aware SVG lockup, `mono` variant for accent surfaces), `UI` (money en-US, Toast, Sheet), `Icon`/`Icons` (SVG path registry), `BankCard` + `SwipeableCards`, `IOSFrame` (device mockup), `Tweaks` (theme panel) |
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
- **Mobile theming:** module-level StyleSheets that use THEME colors must be wrapped in
  `themedSheet(() => StyleSheet.create({...}))`; theme changes go through
  `applyAndSetTheme` in App.tsx (mutate first, then setState) — never call
  `setTheme` with a new palette directly.
- Alerts (`Alert.alert`) only for destructive confirmations — all other feedback via toasts.
- Expo SDK is **54** (`apps/mobile/AGENTS.md` mentions v56 docs — installed SDK wins).
- **EAS monorepo crash:** `apps/mobile/metro.config.js` MUST stay in sync with the
  monorepo structure. Without `watchFolders` + `nodeModulesPaths` pointing to the repo
  root, hoisted native packages (expo-local-authentication, react-native-svg, …) are
  not compiled into the standalone APK → instant crash on launch. Never delete it.
- **EAS standalone builds require three configs** that Expo Go provides implicitly:
  `babel.config.js` (with `babel-preset-expo`), `metro.config.js` (monorepo roots),
  and `EXPO_USE_METRO_WORKSPACE_ROOT=1` in `eas.json` env. Missing any one → crash.
- **EAS plugins:** every native Expo package used by the mobile app MUST appear in the
  `plugins` array in `app.json` (currently: expo-local-authentication, expo-secure-store,
  expo-camera). Adding a native package without its plugin → crash on standalone build.
- **Android launcher icon ≠ `icon.png`:** Android uses `android.adaptiveIcon`
  (foreground/monochrome PNGs + `backgroundColor`), which takes precedence over
  `icon.png`. Rebrand = regenerate the `android-icon-*.png` assets too
  (see docs/design-system.md → Logo).
