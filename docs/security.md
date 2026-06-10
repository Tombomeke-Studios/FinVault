# FinVault Security

Security posture of the demo and the reasoning behind it. Last updated: 2026-06-10.

## Authentication & sessions

| Mechanism | Detail |
|---|---|
| Password hashing | bcrypt, cost factor **12** |
| Password policy | ≥8 chars, upper + lower + digit (Zod `RegisterSchema`) |
| Access token | JWT, **1 hour**, signed with `JWT_SECRET` |
| Refresh token | JWT, **7 days**, stored **sha256-hashed** in `RefreshToken` table |
| Rotation | `/auth/refresh` revokes the used token and issues a new pair. **Replaying a rotated token revokes all of that user's sessions** (theft signal). |
| Revocation | `/auth/logout` marks the refresh token revoked (idempotent, audited) |
| Lockout | 10 failed logins for one email → account `frozen` + `account.frozen` event |
| Rate limits | login 5/15 min/IP, registration 3/h/IP, gateway-wide 500/min/IP |
| Error hygiene | Login failures return a single generic message — no account-existence or attempt-count leak (details go to the audit log only) |
| Mobile storage | Token pair in iOS Keychain / Android Keystore (`expo-secure-store`); auto-refresh on expiry; server-side revocation on sign-out |
| Web storage | `localStorage` (`finvault_token`) — *known gap, see below* |

## Service-to-service trust

- Internal endpoints (`/users/profile-by-email`, `/transactions/internal-transfer`,
  gateway Event Hub) require the `X-Service-Secret` header (`SERVICE_SECRET` env).
- `shared/auth.ts` logs loud warnings whenever `JWT_SECRET` / `SERVICE_SECRET` fall
  back to the in-repo development values.

## Transport & headers

- Every service runs `helmet()`.
- Gateway CORS: open in local demo; set `CORS_ORIGINS` (comma-separated) to enforce an
  allowlist. JSON bodies capped at 1 MB.
- WebSocket connections authenticate with a verified JWT before being registered.

## Data integrity & audit

- Each transaction stores an HMAC integrity hash (`FINVAULT_MESSAGE_KEY`) computed
  over sender/receiver/amount/reference/currency — tamper-evidence for the ledger.
- All auth events (success, failure, freeze, refresh, logout) land in `AuditLog`
  with IP and user agent; users can view them in the app (Settings → Security activity).
- Transfers run inside Prisma `$transaction` blocks; SEPA IBANs are mod-97 validated.

## Demo mode

When the backend is unreachable, the apps fall back to a purely client-side demo
session (`mock-token`) with fabricated data. This is intentional for portfolio/demo
use; nothing in demo mode talks to a server, and the mock token is never accepted by
any service.

## Known gaps / future work

- Web dashboard keeps the access token in `localStorage` and has no refresh flow yet
  (mobile does). Consider httpOnly cookie sessions or in-memory token + refresh.
- Rate limiting is in-memory per instance — use Redis when running replicas.
- Account freeze-on-lockout has no self-service unfreeze flow (support-only by design).
- Card PAN/CVV are demo values stored in plain text — fine for fake data, never for
  real card data (PCI scope).
- No 2FA; the mobile "Face ID" button simulates biometrics rather than calling
  `expo-local-authentication`.
