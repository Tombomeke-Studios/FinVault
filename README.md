# FinVault

Microservices-driven banking and wallet platform.

[![Architecture](assets/badges/architecture.svg)](https://github.com/tombomeke-studio/FinVault)
[![Language](assets/badges/language.svg)](https://github.com/tombomeke-studio/FinVault)
[![Database](assets/badges/database.svg)](https://github.com/tombomeke-studio/FinVault)
[![CI/CD](assets/badges/pipeline.svg)](https://github.com/tombomeke-studio/FinVault)
[![Deploy](assets/badges/deploy.svg)](https://github.com/tombomeke-studio/FinVault)

---

## Overview

FinVault is a high-end, event-driven banking platform designed for maximum scalability and robustness. It uses a decoupled microservices architecture where services communicate asynchronously via events (RabbitMQ) and push live updates to clients via WebSockets.

The project ships two frontends — an **Expo mobile app** (React Native, SDK 54) and a **Vite web dashboard** (React 18) — backed by four Express microservices with Prisma/SQLite and a shared TypeScript library.

---

## Project Structure

The repository is set up as an npm workspaces monorepo with clear service boundaries:

```
FinVault/
├── apps/
│   ├── mobile/                  # Expo (React Native) mobile app
│   └── web-dashboard/           # React + Vite frontend
├── services/
│   ├── gateway/                 # API Gateway + WebSocket Event Hub
│   ├── account-service/         # Identity & Authentication (Prisma + SQLite, JWT)
│   ├── wallet-transaction-service/ # Ledger, Balances & P2P transaction processing
│   └── invoice-service/         # Invoices, payment requests & mandates
├── shared/                      # Shared TypeScript types, auth, events, validation
├── docs/                        # Architecture, security, design system, CI/CD, roadmap
├── docker-compose.yml           # Multi-container orchestration (RabbitMQ + services)
└── package.json                 # Monorepo root config
```

---

## Technical Architecture

### 1. API Gateway & WebSocket Hub
The Gateway serves as the single entry point for both the web dashboard and mobile app. It also runs a WebSocket server that links active user sessions and pushes real-time balance and transaction alerts.

### 2. Account Service
Handles authentication, registration (including profile creation and master UUID assignment), and audit logging of security events. Passwords are hashed with bcrypt (cost 12); sessions are managed via rotating JWT token pairs with refresh-token revocation.

### 3. Wallet & Transaction Service
The financial core of the system. Transactions are processed using a double-entry ledger principle (simultaneous debit and credit) wrapped in atomic database transactions. Includes automatic duplicate detection within a 30-second window, SEPA transfer validation, beneficiary management, and savings goals.

### 4. Invoice Service
Generates PDF invoices, manages payment requests and SEPA direct debit mandates.

---

## Database Configuration

For a frictionless local start, FinVault uses **SQLite** databases (`account.db` and `wallet.db`) managed via Prisma ORM.

### Migrating to PostgreSQL / MySQL (Production)
When hosting the application via Docker on a VM or Kubernetes, you can spin up a separate database container (e.g. PostgreSQL). Thanks to Prisma, this requires no code changes:

1. Open the schema file of the desired service, e.g. `services/account-service/prisma/schema.prisma`.
2. Update the `datasource db` configuration:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Add the `DATABASE_URL` environment variable to your Docker environment config.
4. Run the migration: `npx prisma db push`.

---

## Test Accounts & Links

### Pre-seeded test accounts
Two accounts are generated automatically when the `account-service` starts:

| Account | Email | Password |
|---|---|---|
| Business / Admin | `admin@finvault.com` | `admin123` |
| Personal / Consumer | `test@finvault.com` | `test123` |

> [!TIP]
> Log in with either account in the Web Dashboard or the Mobile App to get immediate access to a fully functional account with an auto-generated IBAN, starting balance, real-time syncing bank cards and savings goals. When the backend is not reachable, both apps fall back to a client-side demo mode.

### Local service URLs

| Service / Dashboard | URL | Notes |
|---|---|---|
| **Web Dashboard** | http://localhost:3000 | React + Vite frontend |
| **API Gateway** | http://localhost:8000 | REST & WebSocket entry point |
| **Account Service** | http://localhost:8001 | Auth & user profiles |
| **Wallet Service** | http://localhost:8002 | Ledger, transfers, cards, goals |
| **Invoice Service** | http://localhost:8003 | Invoices, payment requests, mandates |
| **RabbitMQ Management** | http://localhost:15672 | `guest` / `guest` (Docker only) |

---

## Getting Started

### 1. Prerequisites
- Node.js v18+
- (Optional) Docker for RabbitMQ and containerized deployment

### 2. Install & set up databases

```bash
npm install

npx prisma db push --schema=services/account-service/prisma/schema.prisma
npx prisma db push --schema=services/wallet-transaction-service/prisma/schema.prisma
```

### 3. Start everything (dev mode)

```bash
npm run dev        # Gateway + 3 services + web dashboard
npm run dev:all    # Same + Expo mobile (opens Expo Go)
```

The web dashboard is available at http://localhost:3000, the API gateway at http://localhost:8000.

### 4. Run tests

```bash
npx vitest run     # All unit tests (58 tests across 11 files)
npm run build      # Typecheck + build all workspaces
```

### 5. Mobile app (Expo Go)

1. Install **Expo Go** on your iOS or Android device.
2. Run `npm run dev:mobile` from the monorepo root.
3. Scan the QR code in the terminal with your camera (iOS) or the Expo Go app (Android).
4. Set `EXPO_PUBLIC_API_URL` in `.env` if the backend runs on a different host.

### 6. EAS Build (standalone APK / AAB)

```bash
cd apps/mobile
npx eas build --profile preview --platform android   # Sideloadable APK
npx eas build --profile production --platform android # Signed AAB for Play Store
```

See [docs/deployment-strategy.md](docs/deployment-strategy.md) for the full deployment guide.

---

## Docker Deployment

Every service and the web dashboard are fully prepared for Docker. Start the entire stack via Docker Compose (includes a built-in RabbitMQ broker):

```bash
docker-compose up --build -d
```

---

## Documentation

| Document | Contents |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Agent rules, codebase map, conventions & gotchas |
| [TODO.md](TODO.md) | Task tracking & progress |
| [docs/architecture.md](docs/architecture.md) | Service topology, endpoints, events |
| [docs/security.md](docs/security.md) | Auth, sessions, secrets, rate limits |
| [docs/design-system.md](docs/design-system.md) | Tokens, components, motion, QR codes, a11y |
| [docs/ci-cd.md](docs/ci-cd.md) | GitHub Actions workflows |
| [docs/feature-roadmap.md](docs/feature-roadmap.md) | Feature matrix vs. real banking apps |
| [docs/deployment-strategy.md](docs/deployment-strategy.md) | EAS Build, VM hosting, Play Store |
