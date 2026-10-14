# FinVault Architecture

> Last updated: 2026-06-21 · v2.0.0

FinVault is a fintech banking platform built as an npm workspaces monorepo with two frontends and an event-driven microservices backend.

---

## System Overview

```mermaid
graph TB
    subgraph Clients
        MOB["📱 Mobile App<br/><small>Expo SDK 54 · React Native</small>"]
        WEB["🖥️ Web Dashboard<br/><small>Vite · React 18</small>"]
    end

    subgraph Gateway["API Gateway :8000"]
        PROXY["REST Proxy"]
        WS["WebSocket Hub"]
        RL["Rate Limiter<br/><small>Redis / in-memory</small>"]
        EH["Event Hub"]
    end

    subgraph Services
        ACC["Account Service :8001<br/><small>Auth · Users · Sessions</small>"]
        WAL["Wallet Service :8002<br/><small>Ledger · Transfers · Cards</small>"]
        INV["Invoice Service :8003<br/><small>Receipts · Mandates</small>"]
    end

    subgraph Data
        DB1["SQLite<br/><small>account.db</small>"]
        DB2["SQLite<br/><small>wallet.db</small>"]
        DB3["SQLite<br/><small>invoice.db</small>"]
        RMQ["RabbitMQ<br/><small>Topic Exchange + DLQ</small>"]
    end

    MOB -->|"HTTPS /api/*"| PROXY
    WEB -->|"HTTPS /api/*"| PROXY
    MOB -.->|"WS ?token=JWT"| WS
    WEB -.->|"WS ?token=JWT"| WS

    PROXY --> ACC
    PROXY --> WAL
    PROXY --> INV

    ACC --> DB1
    WAL --> DB2
    INV --> DB3

    EH --> RMQ
    RMQ --> WAL
    RMQ --> INV

    ACC -->|"events"| EH
    WAL -->|"events"| EH

    style Gateway fill:#1a1a2e,stroke:#34d399,color:#f7f7f9
    style Services fill:#1a1a2e,stroke:#60a5fa,color:#f7f7f9
    style Data fill:#1a1a2e,stroke:#a78bfa,color:#f7f7f9
    style Clients fill:#1a1a2e,stroke:#fbbf24,color:#f7f7f9
```

---

## Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant A as Account Service
    participant W as Wallet Service
    participant R as RabbitMQ
    participant WS as WebSocket Hub

    C->>G: POST /api/auth/login
    G->>A: proxy → POST /auth/login
    A-->>G: { accessToken, refreshToken }
    G-->>C: 200 OK + tokens

    C->>G: POST /api/transactions/transfer
    G->>W: proxy → POST /transactions/transfer
    W->>W: validate, debit/credit in $transaction
    W->>G: POST /api/events/publish
    G->>R: events.payment.confirmed
    G->>WS: push to sender + receiver
    W-->>G: 200 OK + transaction
    G-->>C: 200 OK
```

---

## Gateway Routes

```mermaid
graph LR
    subgraph "/api"
        AUTH["/auth/*"] --> ACC["Account :8001"]
        USERS["/users/*"] --> ACC
        WALLETS["/wallets/*"] --> WAL["Wallet :8002"]
        TX["/transactions/*"] --> WAL
        CARDS["/cards/*"] --> WAL
        GOALS["/goals/*"] --> WAL
        BENEF["/beneficiaries/*"] --> WAL
        SCHED["/scheduled-payments/*"] --> WAL
        BUDG["/budgets/*"] --> WAL
        NOTIF["/notifications/*"] --> WAL
        DISP["/disputes/*"] --> WAL
        FX["/fx/*"] --> WAL
        INV["/invoices/*"] --> INVSVC["Invoice :8003"]
    end

    style ACC fill:#3b82f6,color:#fff
    style WAL fill:#34d399,color:#000
    style INVSVC fill:#a78bfa,color:#fff
```

---

## Data Models

### Account Service

```mermaid
erDiagram
    User ||--o| UserProfile : has
    User ||--o{ RefreshToken : owns
    User ||--o{ AuditLog : generates

    User {
        string id PK
        string email UK
        string passwordHash
        string accountType
        string status
        string plan
    }
    UserProfile {
        string userId PK
        string firstName
        string lastName
    }
    RefreshToken {
        string id PK
        string tokenHash
        boolean revoked
        datetime expiresAt
    }
    AuditLog {
        string id PK
        string action
        string ipAddress
        datetime timestamp
    }
```

### Wallet Service

```mermaid
erDiagram
    Wallet ||--o{ BalanceHistory : tracks
    Wallet ||--o| CreditLine : extends
    Wallet ||--o{ Card : has

    Wallet {
        string id PK
        string userId
        string iban UK
        string currency
        string type
        float balance
    }
    Transaction {
        string id PK
        string reference UK
        string senderWalletId FK
        string receiverWalletId FK
        float amount
        string status
        string integrityHash
    }
    SavingsGoal {
        string id PK
        string userId
        string name
        float target
        float saved
    }
    ScheduledPayment {
        string id PK
        string userId
        string frequency
        datetime nextRunAt
        string status
    }
    Budget {
        string id PK
        string userId
        string category
        float monthlyLimit
        float currentSpend
    }
    Notification {
        string id PK
        string userId
        string title
        boolean read
    }
    Dispute {
        string id PK
        string transactionId
        string reason
        string status
    }
```

---

## Service Responsibilities

### Account Service `:8001`

| Endpoint | Method | Purpose |
|---|---|---|
| `/auth/register` | POST | User registration with Zod validation |
| `/auth/login` | POST | Login with bcrypt (cost 12) + JWT pair |
| `/auth/refresh` | POST | Token rotation; replay revokes all sessions |
| `/auth/logout` | POST | Refresh token revocation |
| `/users/profile` | GET | Authenticated user profile |
| `/users/plan` | PUT | Plan upgrade (Standard/Metal/Metal+) |
| `/users/change-password` | POST | Password change + session revocation |
| `/users/sessions` | GET | List active refresh tokens |
| `/users/sessions/:id` | DELETE | Revoke a specific session |
| `/users/audit-logs` | GET | Security activity log |
| `/users/profile-by-email` | GET | Internal (X-Service-Secret) |

### Wallet Service `:8002`

| Endpoint | Method | Purpose |
|---|---|---|
| `/wallets` | GET/POST | Multi-wallet management |
| `/transactions` | GET | Filterable (date, amount, wallet) |
| `/transactions/transfer` | POST | P2P by email or IBAN |
| `/transactions/own-transfer` | POST | Between own wallets |
| `/transactions/sepa-transfer` | POST | SEPA XML transfer |
| `/cards` | GET/POST | Card management |
| `/cards/:id/freeze` | PUT | Freeze/unfreeze |
| `/cards/:id/controls` | PUT | Contactless/foreign/ATM toggles |
| `/goals` | CRUD | Savings goals |
| `/goals/:id/fund` | POST | Fund a goal |
| `/goals/:id/round-up` | POST | Round-up savings |
| `/scheduled-payments` | CRUD | Standing orders |
| `/budgets` | GET/POST/DELETE | Monthly category budgets |
| `/notifications` | GET | User notifications |
| `/notifications/:id/read` | PUT | Mark as read |
| `/notifications/read-all` | PUT | Mark all as read |
| `/disputes` | GET/POST | Transaction disputes |
| `/fx/rates` | GET | Exchange rate table |
| `/fx/exchange` | POST | Currency exchange |
| `/beneficiaries` | CRUD | Saved payees |

### Invoice Service `:8003`

| Endpoint | Method | Purpose |
|---|---|---|
| `/receipts` | GET/POST | Transaction receipts + PDF (`GET /receipts/:id/pdf` — relayed by the gateway as the PDF it is, #95) |
| `/payment-requests` | GET/POST | Payment requests; each one says whether it is `incoming` or `outgoing` for the caller |
| `/payment-requests/:id/pay` | POST | Pay a request |
| `/payment-requests/:id/decline` | POST | Decline a request |
| `/mandates` | GET/POST | SEPA direct debit mandates |
| `/mandates/:id/cancel` | POST | Cancel a mandate |

---

## Event System

```mermaid
graph LR
    subgraph Publishers
        A["Account Service"]
        W["Wallet Service"]
    end

    subgraph "Event Hub (Gateway)"
        HUB["POST /api/events/publish"]
    end

    subgraph Consumers
        WH["Webhook Subscribers"]
        WSC["WebSocket Clients"]
        RMQ["RabbitMQ Queue"]
    end

    A -->|"account.created<br/>account.frozen"| HUB
    W -->|"balance.updated<br/>payment.confirmed"| HUB

    HUB --> WH
    HUB --> WSC
    HUB --> RMQ

    RMQ -->|"events.account.created"| W
    RMQ -->|"events.account.frozen"| W

    style HUB fill:#34d399,color:#000
```

| Event | Publisher | Payload | Consumers |
|---|---|---|---|
| `account.created` | Account | userId, email, accountType | Wallet (creates default wallets + cards) |
| `account.frozen` | Account | userId, reason | Wallet (freezes all wallets) |
| `balance.updated` | Wallet | walletId, userId, balance | WebSocket → client |
| `payment.confirmed` | Wallet | transaction details | WebSocket → sender + receiver |
| `payment.request` *(external, on `bank.payment.request`)* | NexusInfra | reference, customerEmail, amount, currency | Invoice (creates a payment request for the customer) |
| `payment.confirmed` / `payment.failed` | Invoice | the requester's reference, amount / reason | NexusInfra (credits or fails the top-up) |
| `invoice.generate` *(external)* | NexusInfra | reference, customerEmail, period, amount | Invoice (records a monthly hosting statement for the customer) |

### External payment requests (NexusInfra top-ups)

NexusInfra's hosted edition sells server hosting on prepaid credit and collects the money through
FinVault. It shares this broker and `FINVAULT_MESSAGE_KEY`, and the two systems only ever talk over
events:

```mermaid
sequenceDiagram
    participant N as NexusInfra (billing bridge)
    participant R as RabbitMQ
    participant I as Invoice Service
    participant C as Customer (web / mobile)
    participant W as Wallet Service

    N->>R: payment.request on bank.payment.request (reference, customerEmail, amount)
    R->>I: finvault.invoice.external-requests
    I->>I: create a payment request for customerEmail, payable to the merchant account
    C->>I: Pay (or Decline) under Invoices → Payment Requests
    I->>W: transfer customer → merchant
    I->>R: payment.confirmed (NexusInfra's reference + amount) via the Event Hub
    R->>N: credit is added
```

- **Off unless `NEXUSINFRA_MERCHANT_EMAIL` is set** to an existing FinVault account, and `RABBITMQ_URL`
  is configured. That account receives the money; a request never names its own payee.
- **Who pays is an email**, because a NexusInfra user id means nothing here. FinVault does not check
  that an account with that email exists — the request simply waits for one — so a requester learns
  nothing about who banks here.
- **Delivered twice is created once**: a reference that already has a request creates nothing. One
  consumer takes requests one at a time, so looking first is enough.
- **A request FinVault cannot honour is answered**, with `payment.failed` and the reason (no customer
  email, a non-EUR currency, an amount over the limit, no merchant account, or five requests already
  open for that customer from the same requester — the email is unverified on the other side, and
  without a cap anyone could fill a stranger's list).
- **The answer is sent at least once.** It is marked as sent only when the Event Hub accepted it and
  retried every minute otherwise: by then the customer's money has moved.
- **A monthly statement closes the loop (#94).** When a billing month closes NexusInfra publishes
  `invoice.generate`; the Invoice Service records it for the FinVault account with that address, where
  it appears under Invoices → Receipts with a PDF: *Server hosting — usage for September 2026, paid from
  your prepaid credit*. It is a statement, not a payment — the money moved when the top-up was paid.
  Filed under a reference of its own (`HOST-<month>-<digest>`), because the requester's contains
  characters a file name cannot. Delivered twice is recorded once; an address with no account here is
  skipped.
- **Paying claims the request first** (`pending → processing`) and releases the claim if the transfer
  does not happen, so two taps on Pay cannot transfer twice. This applies to every payment request,
  not only external ones.

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Mobile** | Expo SDK 54, React Native 0.81 | Cross-platform mobile app |
| **Web** | Vite, React 18, React Router | Single-page dashboard |
| **Backend** | Express.js, TypeScript, ESM | REST API services |
| **ORM** | Prisma 5 | Type-safe database access |
| **Database** | SQLite (dev), PostgreSQL-ready | Per-service data store |
| **Auth** | JWT + bcrypt + sha256 | Token-based authentication |
| **Messaging** | RabbitMQ (AMQP) | Async event streaming |
| **Rate Limiting** | ioredis / in-memory | Request throttling |
| **Validation** | Zod | Runtime schema validation |
| **Testing** | Vitest | Unit + integration tests |
| **CI/CD** | GitHub Actions | Validation + Docker builds |
| **Build** | EAS Build | Android APK/AAB |

---

## Conventions

- Both frontends implement the same screen set in parallel — a change in one usually needs a sibling change in the other.
- Mobile uses `THEME` object tokens (hex); web uses OKLCH CSS custom properties.
- Money formatting differs per app — see [CLAUDE.md](../CLAUDE.md) gotchas.
- `shared/` is consumed from `dist/` — rebuild after edits (`npm run build --workspace=shared`).
