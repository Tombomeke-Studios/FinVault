# FinVault TODO

Single source of truth for all tasks and progress (CLAUDE.md contains **no** to-dos).
Workflow rules live in [CLAUDE.md](CLAUDE.md#workflow-rules); short version:

- Tasks are **grouped per branch**. Pick a group, work it top to bottom.
- **Definition of done per item:** code + one small commit + docs updated + tests
  written + this file ticked. Only then start the next item.
- **Branch group complete → push → PR → CI green** (`validate.yml`). Red PR ≠ done.

## Branch: `feature/security-and-session` — ✅ complete, ready for PR

- [x] Backend: protect `/users/profile-by-email` with `X-Service-Secret` (was public via gateway → user enumeration + PII leak)
- [x] Backend: hash refresh tokens at rest (sha256), `/auth/refresh` rotation + `/auth/logout` revocation
- [x] Backend: generic login error (no attempt-count / account-existence leak), bcrypt 10 → 12
- [x] Backend: fallback-secret warnings, configurable CORS origins, rate-limit map cleanup
- [x] Root `.env.example` documenting all env vars
- [x] Mobile: persistent session (expo-secure-store) — auto-login, silent refresh, server-side revoke on sign-out
- [x] Mobile: "Security activity" view in Settings (`/api/users/audit-logs`, mock fallback offline)
- [x] Docs: `docs/architecture.md`, `docs/design-system.md`, `docs/security.md`
- [ ] Push branch + open PR, verify CI green *(needs remote push approval)*

## Backlog — ungrouped (assign to a branch group when picked up)

**Candidate group: `feature/web-session-hardening`**
- [ ] Web: adopt refresh-token flow (localStorage → in-memory token + refresh, or httpOnly cookie)
- [ ] Web: sign-out should revoke the refresh token server-side (parity with mobile)

**Candidate group: `feature/mobile-feature-parity`**
- [ ] Mobile: per-wallet filter on the transactions screen (web has `?walletId=` filter banner)
- [ ] Mobile: wire "Request money" tab to the payment-request backend (currently toast-only)
- [ ] Mobile: real biometrics via `expo-local-authentication` (Face ID button is simulated)

**Candidate group: `feature/mobile-theming`**
- [ ] Mobile theming engine — Settings presets currently only fire a toast; app is dark-only

**Candidate group: `feature/transfer-validation`**
- [ ] Transfer screen (mobile + web): validate recipient field before proceeding to amount step
  — accept IBAN, email, or name; show inline error if format is invalid or lookup returns nothing
- [ ] Transfer screen: allow entering a **custom recipient name** instead of only hardcoded accounts;
  the name field must be editable and passed through to the transaction description
- [ ] Transfer to hardcoded demo accounts shows "succeeded" toast but no transaction is created
  and nothing appears in logs — the backend call either silently swallows the error or the
  route is not being hit; add server-side logging + return a proper error response so the
  UI can surface it (both mobile and web)
- [ ] After a successful transfer the sender wallet balance must update immediately (optimistic
  update or re-fetch); currently the overview does not reflect the deduction

**Smaller / unscheduled**
- [ ] Backend: tests for `/auth/refresh` rotation + replay-revocation and `/auth/logout`
- [ ] Card "limits & controls" toggles (contactless/foreign) are client-side only — add backend fields
- [ ] Savings goal "due date" is free text — date picker
- [ ] Invoice service has no frontend surface yet
- [ ] Virtualize mobile transaction list if data volumes grow
- [ ] Rate limiting is per-instance in-memory — Redis when running replicas
- [ ] RabbitMQ is Docker-only for local dev — run `docker run -d --name rabbitmq -p 5672:5672 rabbitmq:3`
  then add `RABBITMQ_URL=amqp://guest:guest@localhost:5672` to `.env` to enable async events

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
