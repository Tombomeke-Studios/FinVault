# Feature roadmap — FinVault vs. a real retail banking app

Audit date: 2026-06-11. This doc compares FinVault's feature set against what a
production retail banking app (Revolut/N26/KBC-class) ships, and prioritizes the gaps.
Each actionable gap has a GitHub issue (CLAUDE.md §2a); update this doc when a gap
ships or a priority changes.

## 1. What FinVault already has

| Domain | Present today |
|---|---|
| Accounts | Multi-wallet (checking/savings/travel) with IBANs, balances, interest rate, credit line endpoint, per-account dashboard |
| Payments | P2P transfer by email, own-account transfer, SEPA transfer endpoint + IBAN validator, deposits/top-up |
| Cards | Physical + virtual, freeze, spend limit, detail reveal + copy, schemes |
| Savings | Goals with funding, progress, CRUD persistence |
| Insights | Spend by category, monthly in/out, balance trend (both apps) |
| Auth & security | Register/login, refresh-token rotation + revocation, lockout, rate limits, audit log ("Security activity"), persistent mobile sessions |
| Plans | Standard/Metal/Metal+ with upgrade flow |
| Realtime | WebSocket hub: `balance.updated`, `payment.confirmed` |
| Back office | Invoice service: invoices, payment requests, SEPA mandates, PDF generation (**no frontend surface**) |
| Theming/UX | Full theme engines on web + mobile, toasts, motion systems, a11y baseline |

## 2. Gap analysis

Priority key: **P1** = core banking feature users expect daily · **P2** = expected but
secondary · **P3** = differentiator/nice-to-have. Effort: S/M/L.

| # | Gap | Why it matters | Prio | Effort | Issue |
|---|---|---|---|---|---|
| 1 | **Statements & export** — Activity "Export" button is a fake toast; no CSV/PDF statements | Every bank offers downloadable statements; needed for taxes/bookkeeping | P1 | S | #24 |
| 2 | **Beneficiaries / saved payees** — every transfer re-enters recipient details | Core daily-payments UX; prerequisite for trusted-payee limits | P1 | M | #25 |
| 3 | **Scheduled & recurring payments / standing orders** — no way to pay rent monthly | Core banking; needs backend model + due-date runner | P1 | L | #26 |
| 4 | **Payment requests UI** — backend exists (invoice service), mobile tab is toast-only | Closes the loop on an already-built backend | P1 | M | #6 / #16 |
| 5 | **Transaction search & filters** — web has free-text search + type chips, but no date-range/amount filters; mobile has no search at all | Expected on any activity feed | P2 | S | #27 |
| 6 | **Budgets & category limits** — insights are read-only; no monthly budget per category with alerts | Standard neo-bank feature, builds on existing category data | P2 | M | #28 |
| 7 | **Direct debits / mandates UI** — mandates exist in invoice-service only | Visibility + cancel control is a PSD2 expectation | P2 | M | #29 |
| 8 | **Security center** — change password, active sessions/device list with remote sign-out, real 2FA (TOTP) | Audit log exists; management actions are missing | P2 | M | #30 |
| 9 | **Notification center** — bell menu is session-only; no persistence/read state | Users expect a durable inbox of payment events | P2 | M | #31 |
| 10 | **FX / currency conversion** — travel wallet exists but no exchange flow or rates | Differentiator that the multi-currency model already hints at | P3 | M | #32 |
| 11 | **Round-up savings** — auto-round card payments into a goal | Classic neo-bank delighter, builds on goals + transactions | P3 | S | #33 |
| 12 | **Dispute / report a transaction** — no flow to flag fraud or errors | Trust feature; can start as a support ticket | P3 | S | #34 |
| 13 | **In-app support** — no help center/FAQ/contact | Expected, low urgency in a demo | P3 | S | — (backlog note) |
| 14 | **KYC-ish onboarding** — register hardcodes DOB/address | Realism of the demo; validation exists server-side already | P3 | S | — (backlog note) |

Deliberately out of scope for a demo: real payment rails, joint accounts, lending
products, investment/trading, cheque deposit, branch/ATM finder.

## 3. Suggested build order

1. **#24 statements/CSV export** (S, removes a fake button — quick honest win)
2. **#25 beneficiaries** (unlocks #26-class trusted flows and speeds up transfers)
3. **#27 search & filters** (S, high daily value)
4. **#16/#6 invoice + payment-request surfaces** (backend already done)
5. **#26 scheduled payments** (largest single feature; model + runner + UI ×2)
6. Then P2 security/budgets/notifications, P3 delighters.

## 4. Maintenance

- When a gap ships: tick it here with the PR number and move the TODO group to Done.
- When adding a *new* feature idea: add a row with prio/effort and create the issue —
  this table is the product backlog's source of truth; TODO.md tracks execution.
