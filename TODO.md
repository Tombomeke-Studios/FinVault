# FinVault TODO

Living checklist — keep this current while working. Newest work at the top.

## In progress — `feature/security-and-session`

- [x] Backend security: protect `/users/profile-by-email` with `X-Service-Secret` (was public via gateway → user enumeration + PII leak)
- [x] Backend security: hash refresh tokens at rest (sha256), `/auth/refresh` rotation + `/auth/logout` revocation
- [x] Backend security: generic login error message (no attempt-count / account-existence leak), bcrypt rounds 10 → 12
- [x] Backend security: warn on JWT fallback secret, configurable CORS origins, rate-limit map cleanup
- [x] Add root `.env.example` documenting all env vars
- [x] Mobile: persistent session (expo-secure-store) — auto-login on relaunch, refresh-token flow, server-side revoke on sign-out
- [x] Mobile: "Security activity" view in Settings (uses `/api/users/audit-logs`, mock fallback in demo mode)
- [x] Docs: `docs/architecture.md`, `docs/design-system.md`, `docs/security.md`
- [ ] Web: adopt refresh-token flow (localStorage → consider httpOnly approach) — *moved to backlog*

## Backlog / known gaps

- [ ] Mobile: theming engine — Settings presets only fire a toast today; mobile is dark-only (web has full `data-*` theming)
- [ ] Mobile: transactions screen lacks per-wallet filter (web has `?walletId=` filter banner)
- [ ] Mobile: "Request money" tab is simulated (fires toast only) — backend has payment-request (Tikkie) schemas
- [ ] Mobile: virtualize transaction list if it grows (currently fine for demo volumes)
- [ ] Card "limits & controls" toggles (contactless/foreign) are client-side only — no backend fields
- [ ] Savings goal "due date" is free text — consider a date picker
- [ ] Invoice service has no frontend surface yet

## Done — UI/UX pass on `(ui/uix)-Rebase-of-UI` (2026-06-10, commit c522017)

- [x] **money() corruption**: nl-NL `€ 4.000,00` was rendered as `€ 40,00` by `.replace('.00','')` call sites → `{ whole: true }` Intl option
- [x] **Broken icons**: trend/target/clock/flame/gift/globe unmapped (rendered "?") → mapped, flame via MaterialCommunityIcons
- [x] **Copy buttons** in card details now really copy (expo-clipboard)
- [x] **Card schemes**: gold/accent offered but missing in BankCard → added
- [x] Toast system replaces blocking Alert.alert for feedback (animated, auto-dismiss, a11y live region)
- [x] MobileSheet: spring slide-up + fading scrim + drag-to-dismiss + KeyboardAvoidingView + inner ScrollView
- [x] Motion.tsx: PressableScale / FadeSlideIn / AnimatedProgressBar, all Reduce-Motion aware; deduped SpringBtn copies
- [x] Android hardware back → returns to Home instead of exiting
- [x] Staggered entrances (Overview, Savings), animated card selection (Cards), animated progress fills
- [x] Plan upgrade sheet: Dutch → English, ✓-text → check icons, white-on-emerald contrast fixed
- [x] Settings: fake chevron rows → real Switch toggles; sign-out a11y
- [x] Auth: autofill/textContentType, password show/hide a11y + hitSlop, submit spinner, card entrance animation
- [x] Accounts carousel snap interval fixed (238 → 234); Sparkline measures container width
- [x] Cash-flow "out" bars visible color; analytics days-left uses real month length (mobile + web)
- [x] API URL via `EXPO_PUBLIC_API_URL`
- [x] Card details auto-hide sensitive data when sheet closes
- [x] Goals: empty state with CTA; 44px touch targets; disabled-state opacities everywhere

## Done — earlier web feedback round (archived)

All items from the original Dutch feedback checklist were completed previously:
total-balance count-up fix, admin checking+savings wallets, centered toasts in mobile frame,
edit/trash icon SVGs, goal persistence (PUT/DELETE endpoints), card swipe carousel with
arrow buttons + active-card balance, clickable account cards & goals preview, logo lockup on
login, SPA router with JWT guards, travel wallet linking, per-wallet transaction filtering.
