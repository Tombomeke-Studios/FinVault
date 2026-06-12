# FinVault TODO

Single source of truth for all tasks and progress (CLAUDE.md contains **no** to-dos).
Workflow rules live in [CLAUDE.md](CLAUDE.md#workflow-rules); short version:

- Tasks are **grouped per branch**. Pick a group, work it top to bottom.
- Every actionable item has a **GitHub issue ref** `(#N)` — created at the latest when
  its group is promoted from the backlog (CLAUDE.md §2a). PRs close them via `Closes #N`.
- **Definition of done per item:** code + one small commit + docs updated + tests
  written + this file ticked. Only then start the next item.
- **Branch group complete → push → PR → CI green** (`validate.yml`). Red PR ≠ done.

## Branch: `feature/android-app-icon` — active (#47, supports #46)

- [x] Replace Expo-template adaptive-icon assets with FinVault-branded ones generated
  from `icon.png` (full-bleed foreground + monochrome silhouette, navy `#062437`
  background color); docs/design-system.md + CLAUDE.md gotcha updated (#47)
- [ ] Fresh EAS preview build from `dev` (first build to include crash fix `4a88ebe`);
  install on device → verify icon **and** that the instant crash is gone (#46)

## 🔴 TOP PRIORITY — EAS CI/CD Workflow (`feature/eas-workflow`)

> See also: [docs/deployment-strategy.md §9](docs/deployment-strategy.md)

- [ ] Create the `EXPO_TOKEN` GitHub Actions secret (#49) — **user action**: generate
      an Expo access token (expo.dev → Account settings → Access tokens, org
      `tombomekestudios`), then `gh secret set EXPO_TOKEN`. Activates the workflow below
- [x] `.github/workflows/build-mobile.yml` (#50): push to `dev` → EAS preview APK,
      push to `main` → EAS production AAB, manual dispatch with profile choice;
      skips with a warning until `EXPO_TOKEN` exists; docs/ci-cd.md table + anatomy
- [ ] Configure `eas.json` `submit.production` once the Play Store account exists (#51)
- [ ] Set `EXPO_PUBLIC_API_URL` EAS env var on expo.dev once the backend is hosted (#52)
- [ ] Translate docs/deployment-strategie.md → English `deployment-strategy.md` (#53)

## Branch: `feature/transfer-validation` — active (#9 #10 #11 #12)

- [x] Backend (#11): request + rejection logging on `/transactions/transfer`, proper
  error responses, `receiverIban` targets (`iban.ts` + 8 tests)
- [x] Web + mobile (#11): stop the false "Payment sent" — handleTransfer throws/returns
  honestly, screens surface the backend reason; mobile drops Alert for warn toasts
- [x] Web + mobile (#9): recipient input accepts email or IBAN with inline validation
  (`lib/validate.ts` mirrors on both apps + tests)
- [x] Web + mobile (#10): editable custom recipient name → transaction description
- [x] Web + mobile (#12): optimistic sender debit + awaited re-fetch before success UI

## Branch: `feature/beneficiaries` — active (#25)

- [x] Backend: `Beneficiary` model (name + email *or* IBAN, unique per user),
  GET/POST/DELETE endpoints, auto-upsert on successful transfers, gateway route
- [x] Web: transfer recipients list shows saved beneficiaries (demo contacts as
  offline fallback); custom recipients are remembered automatically
- [x] Mobile: beneficiary chips prefill the transfer form
- [ ] Docs + roadmap tick, PR → `dev`, CI green, merge

## Branch: `feature/mobile-biometrics` — active (#7)

- [x] `chore(mobile):` expo-local-authentication (#7)
- [x] `src/biometrics.ts`: availability check, system prompt wrapper, keystore-persisted
  opt-in preference (#7)
- [x] Real Face ID button: authenticate → restore stored session (refresh fallback);
  demo session only when no biometric hardware exists (#7)
- [x] Opt-in biometric gate on boot session restore; Settings toggle is functional (#7)
- [ ] PR → `dev`, CI green, merge — **manual device test via Expo Go needed** (like QR)

## Manual device-test checklist (Expo Go) — before promoting `dev` → `staging`

- [ ] QR (#43): scan an EPC QR (generate one on a second device via Request tab);
  verify prefill + transfer; deny camera permission once and re-grant
- [ ] Biometrics (#7): enable the Settings toggle, kill + reopen the app → biometric
  prompt gates auto-login; cancel → auth screen → Face ID button retry works

## Backlog — ungrouped (assign to a branch group when picked up)

**Roadmap gaps (see [docs/feature-roadmap.md](docs/feature-roadmap.md) for prio/effort)**
- [ ] Beneficiaries: saved payees + picker in transfer flows (#25)
- [ ] Scheduled & recurring payments / standing orders (#26)
- [ ] Transactions: date-range + amount filters (search exists on both apps) (#27)
- [ ] Budgets: monthly category limits with progress + alerts (#28)
- [ ] Direct debits: surface SEPA mandates with cancel control (#29)
- [ ] Security center: change password, active sessions, real TOTP 2FA (#30)
- [ ] Notification center with persistence + read state (#31)
- [ ] FX: currency exchange flow for the travel wallet (#32)
- [ ] Round-up savings into a goal (#33)
- [ ] Dispute flow: report a transaction (#34)

**Candidate group: `feature/mobile-feature-parity`**
- [ ] Mobile: per-wallet filter on the transactions screen (web has `?walletId=` filter banner) (#5)
- [ ] Mobile: wire "Request money" tab to the payment-request backend (currently toast-only) (#6)
- [ ] Web: receive-QR parity on the Request tab (no camera needed, reuse EPC builder) — follow-up of #43

**Smaller / unscheduled**
- [ ] Backend: tests for `/auth/refresh` rotation + replay-revocation and `/auth/logout` (#13)
- [ ] Card "limits & controls" toggles (contactless/foreign) are client-side only — add backend fields (#14)
- [ ] Savings goal "due date" is free text — date picker (#15)
- [ ] Invoice service has no frontend surface yet (#16)
- [ ] Virtualize mobile transaction list if data volumes grow (#17)
- [ ] Rate limiting is per-instance in-memory — Redis when running replicas (#18)

**Dev-environment note (not a task):** RabbitMQ is Docker-only for local dev — run
`docker run -d --name rabbitmq -p 5672:5672 rabbitmq:3` then add
`RABBITMQ_URL=amqp://guest:guest@localhost:5672` to `.env` to enable async events.

## Done — `feature/qr-transfers` (merged into `dev` via PR #44, issue #43 auto-closed, 2026-06-12)

- [x] EPC069-12 parser/builder (7 tests); scan-to-pay camera sheet prefills the transfer form
- [x] Receive-QR on the Request tab; camera permission in app.json (manual device test pending)

## Done — `feature/beneficiaries` (merged into `dev` via PR #42, issue #25 auto-closed, 2026-06-12)

- [x] Beneficiary model + CRUD + auto-upsert on transfer; payee grid (web) + prefill chips (mobile)

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
