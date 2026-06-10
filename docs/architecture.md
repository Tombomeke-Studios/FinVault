# FinVault Architecture

FinVault is a fintech banking demo built as a monorepo with two frontends and an
event-driven microservices backend.

```
┌──────────────┐    ┌───────────────────┐
│ apps/mobile   │    │ apps/web-dashboard │
│ Expo SDK 54   │    │ Vite + React 18    │
└──────┬───────┘    └─────────┬─────────┘
       │   HTTPS /api/* + WS (token)
       ▼                      ▼
┌─────────────────────────────────────────┐
│ services/gateway :8000                   │
│ helmet · CORS allowlist · rate limit     │
│ /api proxy · WebSocket hub · Event Hub   │
└──────┬─────────────┬─────────────┬──────┘
       ▼             ▼             ▼
┌────────────┐ ┌──────────────┐ ┌─────────────┐
│ account    │ │ wallet-      │ │ invoice     │
│ service    │ │ transaction  │ │ service     │
│ :8001      │ │ service :8002│ │ :8003       │
│ auth, users│ │ wallets, tx, │ │ invoices,   │
│ audit logs │ │ cards, goals │ │ PDF receipts│
└─────┬──────┘ └──────┬───────┘ └──────┬──────┘
      └──── Prisma/SQLite per service ──┘
              RabbitMQ topic exchange (events.*) + DLQ
```

## Components

### Frontends
- **apps/mobile** — Expo SDK 54 / React Native 0.81, dark-only theme. State is plain
  React state in `App.tsx` (no router lib; `route` string + `account:<walletId>`
  convention). Falls back to a full in-memory demo mode when the backend is
  unreachable (see [security.md](security.md#demo-mode)).
- **apps/web-dashboard** — Vite + React 18 SPA with React Router. Renders a simulated
  iOS device frame ("compact" mode) or a desktop sidebar layout. Full theming engine
  via `data-*` attributes on `<html>` (mode/radius/density/card + accent/font CSS vars).

### Gateway (`services/gateway`)
- Proxies `/api/auth|users → account`, `/api/wallets|transactions|cards|goals → wallet`,
  `/api/invoices → invoice`.
- **WebSocket hub**: clients connect with `?token=<JWT>`; events are pushed per-user.
- **Event Hub** (`POST /api/events/publish`, guarded by `X-Service-Secret`): fans out
  envelopes to subscribed services via webhooks, to WebSocket clients, and onto
  RabbitMQ (`events.<type>` routing keys, with dead-letter queue).
- Per-IP rate limiting (500 req/min) with periodic map cleanup.

### Account service
- Registration/login (Zod-validated, bcrypt cost 12), JWT access tokens (1 h) +
  rotating refresh tokens (7 d, sha256-hashed at rest).
- `/auth/refresh` (rotation; replay revokes all sessions), `/auth/logout` (revocation).
- Per-IP rate limits (5 logins / 15 min, 3 registrations / h) + per-email lockout
  (10 failures → account frozen) + `AuditLog` table for all auth events.
- Internal `/users/profile-by-email` requires `X-Service-Secret`.

### Wallet-transaction service
- Wallets (checking / savings / travel) with IBAN generation, interest simulation,
  credit lines, balance history.
- Transactions: P2P by email, SEPA by IBAN (mod-97 validation in `sepa-validator.ts`),
  own-wallet transfers, deposits — all in Prisma `$transaction` blocks with an
  integrity hash per transaction (`shared/src/integrity.ts`).
- Cards (freeze, limits) and savings goals (fund/edit/delete) CRUD.
- Self-healing seed reconciliation on startup for demo accounts.

### Shared (`shared/`)
- `auth.ts` — JWT verification, `requireAuth`, `requireServiceSecret`, secrets with
  loud dev-fallback warnings.
- `validation.ts` — Zod schemas (auth, deposits, transfers, SEPA, payment requests,
  mandates) + `validateBody` helper.
- `events.ts` / `rabbitmq.ts` — event envelope publishing (gateway hub + RabbitMQ).
- `integrity.ts` — HMAC transaction hashing (`FINVAULT_MESSAGE_KEY`).

## Conventions
- Both frontends implement the same screen set (`ScreenOverview`, `ScreenCards`, …) in
  parallel; a change to one usually wants a sibling change in the other.
- Mobile uses `THEME` object tokens (hex); web uses OKLCH CSS custom properties.
- Money formatting differs per app — see CLAUDE.md "gotchas" before touching it.
- Run order for local dev: RabbitMQ (docker) → services (`npm run dev` each, or
  `docker-compose up`) → web (`npm run dev`) / mobile (`npx expo start`).
