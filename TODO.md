# FinVault TODO

Single source of truth for all tasks and progress (CLAUDE.md contains **no** to-dos).
Workflow rules live in [CLAUDE.md](CLAUDE.md#workflow-rules); short version:

- Tasks are **grouped per branch**. Pick a group, work it top to bottom.
- Every actionable item has a **GitHub issue ref** `(#N)` — created at the latest when
  its group is promoted from the backlog (CLAUDE.md §2a). PRs close them via `Closes #N`.
- **Definition of done per item:** code + one small commit + docs updated + tests
  written + this file ticked. Only then start the next item.
- **Branch group complete → push → PR → CI green** (`validate.yml`). Red PR ≠ done.

## Next steps — post v2.0.0

**Infrastructure & deployment**
- [ ] Enable GitHub branch protection rules on `main` and `staging` (see docs/ci-cd.md §5)
- [ ] Create a Google service-account JSON and place at `apps/mobile/google-services.json` for EAS Submit
- [ ] Set the `EXPO_TOKEN` repository secret on GitHub for automated EAS builds
- [ ] Deploy backend services to a hosted environment (VM, Railway, Fly.io, etc.)
- [x] Point `EXPO_PUBLIC_API_URL` to the live backend (home server `http://192.168.0.117:8000`, all EAS profiles); cleartext only for `http://`; no silent demo fallback in release builds (#104)
- [ ] Expose the gateway on a public HTTPS hostname (Cloudflare Tunnel) so the app works off-LAN / on the Play Store, then switch `EXPO_PUBLIC_API_URL` to it (#105)
- [ ] Run `eas submit --platform android` for the first Play Store upload (internal track)

**Known bugs (next session)**
- [ ] QR scan-to-pay shows "That QR is not a SEPA payment code" — #112 made `parseEpcQr()` tolerate a byte-order mark,
  CR line ends and padded header lines; recheck on a device before closing. — the EPC069-12 parser
  likely rejects the QR format or encoding; debug `parseEpcQr()` in `src/lib/epc.ts`
  and the camera output in `QrScanSheet.tsx`
- [ ] Face ID / fingerprint not working in Expo Go — check `isBiometricAvailable()`
  return value, verify `expo-local-authentication` plugin in `app.json`, test with
  `authenticateBiometric()` debug logging; may need a dev build (Expo Go has limited
  biometric support on some devices)

**Quality & testing**
- [ ] Add integration/E2E tests for the new endpoints (scheduled-payments, budgets, notifications, disputes, FX)
- [ ] Set up staging DB for smoke testing before `staging → main` promotions

**Feature polish (future milestone)**
- [x] TOTP 2FA — real working implementation: setup with QR/secret, verify, enable/disable, 2FA gate on login
- [x] Push notifications — expo-notifications + expo-server-sdk: token registration, server-side sending on transfers
- [ ] Scheduled payment executor — cron job that actually runs due payments
- [ ] App Store submission (the iOS build itself is in the Final Work MVP below)
- [ ] Haptic feedback on mobile (expo-haptics) for transfers, button presses
- [ ] iOS build profile + App Store submission
- [ ] Parallax scroll effect on Overview hero card
- [ ] Swipe-to-delete on transaction list items (swipeable row)
- [ ] Search functionality in web top bar (currently non-functional input)

## Backlog — Final Work (EhB, 2026–2027)

The Final Work turns NexusInfra, FinVault and NexusWatch into one ecosystem. **The showcase in March is
the deadline** — nothing is built after it — so the MVP group is what must work then, and the group
below starts only once it does. For FinVault that means: observable by NexusWatch (no service has
`/health` or `/metrics` today), reachable from the NexusInfra app, and on iOS as well as Android and web.
iOS builds: Laila & Quinten.

**MVP — observability (`feature/observability`)**
- [ ] Add `/health` and Prometheus `/metrics` to every service (gateway, account, wallet, invoice) — follow NexusInfra's `shared/src/metrics.ts`
- [ ] Publish service heartbeats on `monitoring.heartbeat.#` (shared `finvault.events` exchange) — NexusWatch already consumes those keys
- [ ] Count payments and top-ups by outcome as metrics, so NexusWatch can show failed payments and top-ups per day

**MVP — apps (`feature/final-work-apps`)**
- [ ] iOS build of the mobile app from the same Expo codebase, tested on a real iPhone (Expo Go for development; installing a build needs an Apple developer account) — App Store submission stays out of scope
- [ ] Deep link: a `finvault://` URL scheme that opens a payment request or the top-up screen — the NexusInfra app links into it
- [ ] Check the web dashboard against the live backend for everything the MVP shows: balance, transfers, approving NexusInfra's payment requests, hosting statements

**MVP — the chain**
- [ ] Run a top-up end to end with NexusInfra's `docker-compose.finvault.yml` (NexusInfra #428): payment request in the app, approval, credit in NexusInfra

**Only once the MVP is done (still before March)**
- [ ] Correlation id on the event envelope (optional, additive) — mirrors NexusInfra's half; ship together
- [ ] Auto top-up for NexusInfra: the customer authorises NexusInfra with a mandate and a monthly cap; a `payment.request` within the cap is paid without a manual approval, anything above still asks
- [ ] A "Hosting" category: NexusInfra payments and monthly statements count as hosting in insights and budgets, so a budget can cap hosting spend
- [ ] Merchant view on the web dashboard for the NexusInfra merchant account: incoming top-ups, statements filed, failed requests

## Active — `fix/receipt-pdf`

- [x] No receipt PDF can be downloaded: the gateway parses every response as JSON (#95) 🐛

## Done — `feature/qr-topup` (merged into `dev` via PR #113, issue #112 auto-closed, 2026-11-26)

- [x] Pay a NexusInfra top-up by scanning its EPC QR code (#112)

## Done — `feature/private-payment-events` (merged into `dev` via PR #111, issues #108/#110 auto-closed, 2026-11-26)

- [x] The gateway sends every `payment.confirmed` / `payment.failed` to all connected users, amounts and references included (#108) 🐛
- [x] `npm run build` failed on a fresh clone: services built before `shared` (#110) 🐛

## Done — `feature/live-balance` (merged into `dev` via PR #109, issue #107 auto-closed, 2026-11-26)

- [x] Show the new balance right after paying a payment request, and live in the mobile app (#107) 🐛

## Done — `feature/nexusinfra-statements` (merged into `dev` via PR #96, issue #94 auto-closed, 2026-10-14)

- [x] Show a NexusInfra customer their monthly hosting statement (#94)

## Done — `fix/seeded-login` (merged into `dev` via PR #93, issue #92 auto-closed, 2026-10-14)

- [x] The seeded demo customer cannot sign in — its password is shorter than login allows (#92) 🐛

## Done — `feature/nexusinfra-topup` (merged into `dev` via PR #91, issues #89/#90 auto-closed, 2026-10-14)

NexusInfra's hosted edition asks FinVault to collect a customer's credit top-up. Nothing here
consumed the request, and neither app could pay a payment request at all.

- [x] Turn a NexusInfra top-up request into a payment request the customer approves (#89)
- [x] Payment requests cannot be paid or declined from either app (#90) 🐛

## Done — `feature/animations-and-polish` (PR pending)

- [x] CountUp animation on balance (Revolut-style number counter)
- [x] ScaleIn pop animation on plan badge and status badges
- [x] Shimmer skeleton component in Motion library
- [x] SlideInFromRight screen transition component
- [x] CountUp on transaction detail hero amount
- [x] Pull-to-refresh on mobile Overview
- [x] Transaction detail screen (mobile + web)
- [x] Notification bell with unread badge
- [x] Services grid on Overview, Services section in web sidebar
- [x] All web screens polished (Disputes, FX, Mandates, Notifications, Invoices, SecurityCenter)
- [x] Web SecurityCenter: 2FA placeholder, current session badge, labeled form fields, inline validation

**Dev-environment note (not a task):** RabbitMQ is Docker-only for local dev — run
`docker run -d --name rabbitmq -p 5672:5672 rabbitmq:3` then add
`RABBITMQ_URL=amqp://guest:guest@localhost:5672` to `.env` to enable async events.

## Released — v2.0.0 (dev → staging PR #70, staging → main PR #71, tag v2.0.0, 2026-06-21)

## Done — `feature/eas-config` (merged into `dev` via PR #69, issues #51/#52 auto-closed, 2026-06-21)

- [x] Configure eas.json submit.production with serviceAccountKeyPath + track + releaseStatus (#51)
- [x] Set `EXPO_PUBLIC_API_URL` in eas.json production build env (#52)

## Done — `feature/complete-backlog` (merged into `dev` via PR #68, issues #6/#15-18/#26-34 auto-closed, 2026-06-21)

- [x] Scheduled & recurring payments / standing orders (#26)
- [x] Transactions: date-range + amount filters (#27)
- [x] Budgets: monthly category limits with progress + alerts (#28)
- [x] Direct debits: surface SEPA mandates with cancel control (#29)
- [x] Security center: change password, active sessions (#30)
- [x] Notification center with persistence + read state (#31)
- [x] FX: currency exchange flow for the travel wallet (#32)
- [x] Round-up savings into a goal (#33)
- [x] Dispute flow: report a transaction (#34)
- [x] Mobile: wire "Request money" tab to the payment-request backend (#6)
- [x] Invoice service frontend surface — receipts + payment requests (#16)
- [x] Savings goal "due date" — date picker on both apps (#15)
- [x] Virtualize mobile transaction list with FlatList (#17)
- [x] Rate limiting — Redis-backed with in-memory fallback (#18)

## Done — `feature/android-app-icon` (merged into `dev` via PR #48, issue #47 auto-closed, 2026-06-20)

- [x] FinVault-branded adaptive icon (foreground + monochrome); design-system.md + CLAUDE.md updated
- [x] EAS preview build verification deferred to device-test checklist (#46 remains open)

## Done — `feature/eas-workflow` (merged into `dev` via PR #54, issues #50/#53 auto-closed, 2026-06-20)

- [x] `build-mobile.yml` — EAS preview on dev, production AAB on main, manual dispatch
- [x] Translated deployment guide to English (`deployment-strategy.md`)
- Remaining user-dependent items: #49 (EXPO_TOKEN), #51 (Play Store submit), #52 (API URL)

## Done — `feature/qr-transfers` (merged into `dev` via PR #44, issue #43 auto-closed, 2026-06-12)

- [x] EPC069-12 parser/builder (7 tests); scan-to-pay camera sheet prefills the transfer form
- [x] Receive-QR on the Request tab; camera permission in app.json (manual device test pending)

## Done — `feature/beneficiaries` (merged into `dev` via PR #42, issue #25 auto-closed, 2026-06-12)

- [x] Beneficiary model + CRUD + auto-upsert on transfer; payee grid (web) + prefill chips (mobile)

## Done — `feature/web-receive-qr` (merged into `dev` via PR #56, issue #55 auto-closed, 2026-06-20)

- [x] EPC QR builder ported to web (`src/lib/epc.ts`, 7 tests); live QR on Request tab via `qrcode.react`

## Done — `feature/mobile-biometrics` (merged into `dev` via PR #45, issue #7 auto-closed, 2026-06-12)

- [x] Real biometric login with opt-in session-restore gate; Settings toggle functional

## Done — `feature/web-session-hardening` (merged into `dev` via PR #41, issues #3/#4 auto-closed, 2026-06-12)

- [x] In-memory access token + rotating refresh token (`src/lib/session.ts`, 10 tests)
- [x] Sign-out revokes the refresh token server-side; docs/security.md updated

## Done — `feature/transfer-validation` (merged into `dev` via PR #40, issues #9–#12 auto-closed, 2026-06-12)

- [x] Backend: transfer request/rejection logging, `receiverIban` targets (`iban.ts`, 8 tests)
- [x] Both apps: validated email/IBAN recipients, custom names, honest errors, instant balance updates

## Done — `feature/native-issue-autoclose` (merged into `dev` via PR #39, issue #37 closed natively, 2026-06-12)

- [x] `close-linked-issues.yml` removed — default branch is `dev`, GitHub auto-closes natively
- [x] `validate.yml` also validates pushes to `dev`; CLAUDE.md §2/§2a + docs/ci-cd.md updated

## Done — `feature/repo-hygiene` (merged into `dev` via PR #38, 2026-06-11)

- [x] Five merged feature branches deleted; repo setting *Automatically delete head branches* enabled
- [x] CLAUDE.md §2a trigger table + open-issues-are-backlog rule; finish protocol prune step

## Done — `feature/statements-export` (merged into `dev` via PR #36, issue #24 auto-closed, 2026-06-11)

- [x] Web: real CSV download from the Activity screen (filtered rows, UTF-8 BOM, 5 unit tests)
- [x] Mobile: same CSV via the native share sheet (mirrored lib + tests, no new deps)

## Done — `feature/banking-roadmap` (merged into `dev` via PR #35, issue #20 auto-closed, 2026-06-11)

- [x] docs/feature-roadmap.md: present/missing matrix, P1–P3 priorities, build order
- [x] Issues #24–#34 for every actionable gap

## Done — `feature/mobile-theming` (merged into `dev` via PR #23, issue #8 auto-closed, 2026-06-11)

- [x] Theme engine: mutable THEME, dark/light palettes × 6 accents, `themedSheet`, vitest coverage
- [x] Settings presets apply for real; Appearance card (mode toggle + accent dots); secure-store persistence
- [x] docs/design-system.md mobile theming section

## Done — `feature/web-theme-refactor` (merged into `dev` via PR #22, issue #19 auto-closed, 2026-06-11)

- [x] Removed dead `src/theme.css`; theme-aware `FVLogo` SVG (mono variant) replaces white-wordmark PNG
- [x] `index.css` restructured into 7 layered sections with a token contract header
- [x] Light-mode contrast: `--accent-ink`, clamped light accent fills, `--cat-l`/`--cat-soft-a`
- [x] Motion library: SlideDown/BlurIn/Shake/BounceIn/GradShift, `.stagger`, theme cross-fade
- [x] Theme engine in `src/theme.ts` + localStorage persistence; Midnight + Mint presets
- [x] docs/design-system.md: theming contract + motion vocabulary

## Done — `feature/github-workflow` (merged into `dev` via PR #21, 2026-06-11)

- [x] Move stale `feature/security-and-session` group to Done (merged via PR #2)
- [x] CI: `close-linked-issues.yml` — auto-close issues on PR merge into `dev`
- [x] CLAUDE.md §2a: GitHub issue workflow (issue per TODO item, `Closes #N` in PRs)
- [x] docs/ci-cd.md: workflow reference + maintenance guide
- [x] GitHub: `scope:*`/`type:*` labels + issues #3–#20 for all open backlog items
- [x] Push, PR → `dev`, CI green, merged as PR #21

## Done — `feature/security-and-session` (merged into `dev` via PR #2, 2026-06-10)

- [x] Backend: protect `/users/profile-by-email` with `X-Service-Secret` (was public via gateway → user enumeration + PII leak)
- [x] Backend: hash refresh tokens at rest (sha256), `/auth/refresh` rotation + `/auth/logout` revocation
- [x] Backend: generic login error (no attempt-count / account-existence leak), bcrypt 10 → 12
- [x] Backend: fallback-secret warnings, configurable CORS origins, rate-limit map cleanup
- [x] Root `.env.example` documenting all env vars
- [x] Mobile: persistent session (expo-secure-store) — auto-login, silent refresh, server-side revoke on sign-out
- [x] Mobile: "Security activity" view in Settings (`/api/users/audit-logs`, mock fallback offline)
- [x] Docs: `docs/architecture.md`, `docs/design-system.md`, `docs/security.md`
- [x] Push branch + open PR, verify CI green — merged as PR #2

## Done — UI/UX pass on `(ui/uix)-Rebase-of-UI` (2026-06-10, commit c522017)

- [x] **money() corruption**: nl-NL `€ 4.000,00` rendered as `€ 40,00` via `.replace('.00','')` → `{ whole: true }` Intl option
- [x] **Broken icons**: trend/target/clock/flame/gift/globe unmapped (rendered "?") → mapped, flame via MaterialCommunityIcons
- [x] **Copy buttons** in card details now really copy (expo-clipboard)
- [x] **Card schemes**: gold/accent offered but missing in BankCard → added
- [x] Toast system replaces blocking Alert.alert (animated, auto-dismiss, a11y live region)
- [x] MobileSheet: spring slide-up + scrim fade + drag-to-dismiss + keyboard-aware + scrollable
- [x] Motion.tsx: PressableScale / FadeSlideIn / AnimatedProgressBar, Reduce-Motion aware; deduped SpringBtn copies
- [x] Android hardware back → Home instead of app exit
- [x] Staggered entrances, animated card selection, animated progress fills
- [x] Plan sheet: Dutch → English, check icons, on-accent contrast fix
- [x] Settings: fake chevron rows → real switches
- [x] Auth: autofill props, password-toggle a11y, submit spinner, entrance animation
- [x] Carousel snap 238 → 234; Sparkline measures container; cash-flow "out" bars visible
- [x] Analytics days-left uses real month length (mobile + web)
- [x] `EXPO_PUBLIC_API_URL`; sensitive card data auto-hides on sheet close
- [x] Goals empty state + CTA; 44px touch targets; disabled-state visuals

## Done — earlier web feedback round (archived)

All items from the original Dutch feedback checklist were completed previously:
total-balance count-up fix, admin checking+savings wallets, centered toasts in mobile frame,
edit/trash icon SVGs, goal persistence (PUT/DELETE endpoints), card swipe carousel with
arrow buttons + active-card balance, clickable account cards & goals preview, logo lockup on
login, SPA router with JWT guards, travel wallet linking, per-wallet transaction filtering.
