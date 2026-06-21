# FinVault Security

> Last updated: 2026-06-21 · v2.0.0

Security posture of the platform and the reasoning behind each layer.

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client App
    participant G as Gateway
    participant A as Account Service
    participant DB as Database

    U->>C: Enter email + password
    C->>G: POST /api/auth/login
    G->>A: proxy
    A->>DB: Find user by email
    A->>A: bcrypt.compare (cost 12)
    alt Invalid credentials
        A->>DB: Log audit event
        A-->>C: 401 "Invalid email or password"
    else Valid
        A->>A: Issue JWT access (1h) + refresh (7d)
        A->>DB: Store sha256(refreshToken)
        A->>DB: Log "login successful"
        A-->>C: 200 + { accessToken, refreshToken }
    end

    Note over C: Access token in memory<br/>Refresh token in SecureStore (mobile)<br/>or localStorage (web)
```

---

## Token Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active: Login / Refresh
    Active --> Expired: 1h (access) / 7d (refresh)
    Active --> Revoked: Logout / Password change
    Active --> Revoked: Replay detected
    Expired --> [*]
    Revoked --> [*]

    note right of Revoked
        Replay detection: if a rotated
        refresh token is reused, ALL
        user sessions are revoked
        (theft signal)
    end note
```

| Mechanism | Detail |
|---|---|
| **Password hashing** | bcrypt, cost factor **12** |
| **Password policy** | ≥ 8 chars, upper + lower + digit (Zod `RegisterSchema`) |
| **Access token** | JWT, **1 hour**, signed with `JWT_SECRET` |
| **Refresh token** | JWT, **7 days**, stored **sha256-hashed** in `RefreshToken` table |
| **Rotation** | `/auth/refresh` revokes the used token and issues a new pair |
| **Replay detection** | Replaying a rotated token revokes **all** of that user's sessions |
| **Revocation** | `/auth/logout` marks the refresh token as revoked (idempotent, audited) |
| **Password change** | `/users/change-password` revokes all sessions, issues fresh pair |
| **Session management** | `/users/sessions` lists active tokens; `DELETE /:id` revokes one |

---

## Account Protection

```mermaid
graph TD
    LOGIN["Login Attempt"] --> RL{"Rate Limit<br/>5 / 15min / IP"}
    RL -->|Exceeded| BLOCK["429 Too Many Requests"]
    RL -->|OK| VALIDATE{"Credentials<br/>Valid?"}
    VALIDATE -->|No| COUNT{"Failed count<br/>for email"}
    COUNT -->|"< 10"| FAIL["401 + audit log"]
    COUNT -->|"≥ 10"| FREEZE["Account FROZEN<br/>+ event published"]
    VALIDATE -->|Yes| SUCCESS["200 + token pair"]

    style FREEZE fill:#fb7185,color:#fff
    style SUCCESS fill:#34d399,color:#000
    style BLOCK fill:#fbbf24,color:#000
```

| Protection | Config |
|---|---|
| Login rate limit | 5 attempts / 15 min / IP |
| Registration rate limit | 3 accounts / hour / IP |
| Gateway rate limit | 500 requests / min / IP (Redis or in-memory) |
| Account lockout | 10 failed logins → account frozen + `account.frozen` event |
| Error hygiene | Generic "Invalid email or password" — no account-existence or attempt-count leak |

---

## Client Storage

| Platform | Access Token | Refresh Token | Theme Prefs |
|---|---|---|---|
| **Mobile** | In memory (`useState`) | iOS Keychain / Android Keystore (`expo-secure-store`) | SecureStore |
| **Web** | In memory (`useState`) | `localStorage` (`fv_refresh`) | `localStorage` (`fv_theme`) |

### Mobile Biometrics

```mermaid
graph LR
    LAUNCH["App Launch"] --> STORED{"Stored<br/>session?"}
    STORED -->|No| AUTH["Auth Screen"]
    STORED -->|Yes| BIO{"Biometrics<br/>enabled?"}
    BIO -->|No| RESTORE["Silent refresh"]
    BIO -->|Yes| PROMPT["Face ID /<br/>Fingerprint"]
    PROMPT -->|Success| RESTORE
    PROMPT -->|Fail| AUTH
    RESTORE --> HOME["Home Screen"]

    style PROMPT fill:#34d399,color:#000
```

- `expo-local-authentication` for Face ID / fingerprint
- Opt-in preference stored in keystore
- First-login prompt (#62) — dismissed state persisted so it only asks once
- Settings toggle for enable/disable

---

## Service-to-Service Trust

| Mechanism | Where Used |
|---|---|
| `X-Service-Secret` header | `/users/profile-by-email`, `/transactions/internal-transfer`, Event Hub |
| Loud dev-fallback warnings | `shared/auth.ts` logs warnings when `JWT_SECRET` / `SERVICE_SECRET` use built-in values |

---

## Data Integrity

```mermaid
graph LR
    TX["Transaction Created"] --> HASH["HMAC-SHA256<br/>sender + receiver +<br/>amount + ref + currency"]
    HASH --> STORE["integrityHash<br/>stored on record"]
    STORE --> VERIFY["Tamper detection<br/>on read"]

    style HASH fill:#a78bfa,color:#fff
```

- Each transaction stores an HMAC integrity hash (`FINVAULT_MESSAGE_KEY`)
- All auth events logged in `AuditLog` with IP and user agent
- Transfers run inside Prisma `$transaction` blocks
- SEPA IBANs are format-validated (structurally valid, not mod-97 checksummed for demo IBANs)

---

## Transport & Headers

- Every service runs `helmet()` (security headers)
- Gateway CORS: open in local demo; set `CORS_ORIGINS` to enforce an allowlist
- JSON bodies capped at 1 MB
- WebSocket connections authenticate JWT before registration

---

## Demo Mode

When the backend is unreachable, both apps fall back to a purely client-side demo session (`mock-token`) with fabricated data. Nothing in demo mode talks to a server, and the mock token is never accepted by any service.

---

## Known Gaps

| Gap | Risk | Mitigation |
|---|---|---|
| Web refresh token in `localStorage` | XSS can read it | Rotation + replay-revocation limit blast radius; httpOnly cookie would fully eliminate |
| No TOTP 2FA | Account takeover with stolen password | Planned (#30); biometrics cover mobile |
| Card PAN/CVV in plaintext | N/A for demo data | Never store real card data this way (PCI scope) |
| Account freeze has no self-unfreeze | UX friction | By design — support-only unfreeze |
| SecureStore not hardware-encrypted | Token accessible without biometric prompt | Needs dev build for `requireAuthentication` option |
