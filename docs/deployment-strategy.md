# FinVault — Deployment Strategy & Options

> Documented: 2026-06-12  
> Scope: Mobile (Expo/EAS), Backend (Linux VM self-hosting), Web Dashboard

---

## Table of contents

1. [Current situation: how it works today](#1-current-situation-how-it-works-today)
2. [Expo & EAS: from local to Play Store](#2-expo--eas-from-local-to-play-store)
3. [Backend & database self-hosting on a Linux VM](#3-backend--database-self-hosting-on-a-linux-vm)
4. [Network access: reachability from outside](#4-network-access-reachability-from-outside)
5. [What does the Linux VM need?](#5-what-does-the-linux-vm-need)
6. [Overview of all possible approaches](#6-overview-of-all-possible-approaches)
7. [Recommended approach (step by step)](#7-recommended-approach-step-by-step)
8. [Pitfalls & points of attention](#8-pitfalls--points-of-attention)

---

## 1. Current situation: how it works today

```
[Your Windows PC]
  ├── apps/mobile        → npx expo start  (Expo Go / LAN)
  ├── apps/web-dashboard → http://localhost:3000
  └── services/*         → npm run dev  (gateway :8000, account :8001, wallet :8002, invoice :8003)
       └── RabbitMQ      → docker-compose (container)

[Your phone] ─── WiFi/LAN ──→ Expo Dev Server (QR-code scan)
```

**Current limitations:**
- The mobile app only works via Expo Go (no real standalone APK/IPA).
- The backend is only reachable on the local network.
- The app cannot be shared with others unless they are on the same network.
- The app has a *demo mode* when the backend is unreachable.

---

## 2. Expo & EAS: from local to Play Store

### 2.1 What is Expo vs. EAS?

| Tool | Role |
|---|---|
| **Expo CLI** (`npx expo start`) | Local dev server, Expo Go app, hot reload |
| **EAS Build** | Builds real native APK/AAB (Android) or IPA (iOS) in the cloud |
| **EAS Submit** | Pushes the built app automatically to Google Play / Apple App Store |
| **EAS Update** | Over-the-air (OTA) updates: push JS code without a new store release |

### 2.2 Flow: from code to Play Store

```
1. Code ready + eas.json configured
        ↓
2. eas build --platform android --profile production
   → EAS servers build a signed .aab (Android App Bundle)
        ↓
3. Google Play Console (one-time account: ~$25)
   → Create the app, fill in the store listing, add a Privacy Policy
        ↓
4. eas submit --platform android
   → EAS uploads the .aab to the Play Console automatically
        ↓
5. Google review (typically 1–3 days for a first release)
        ↓
6. App live on the Play Store 🎉
```

### 2.3 What do you need for EAS?

**Required:**
- **Expo account** (free on expo.dev)
- **Google Play Developer account** (one-time registration fee: $25)
- **eas.json** in `apps/mobile/` with build profiles
- **app.json** extended with `android.package` (e.g. `com.tombomekestudio.finvault`)
- **Keystore** (signing certificate) — EAS generates this automatically and stores it securely

Both config files exist in `apps/mobile/` today. Reference shape:

**app.json — minimum for the Play Store:**
```json
{
  "expo": {
    "name": "FinVault",
    "slug": "finvault",
    "version": "1.0.0",
    "android": {
      "package": "com.tombomekestudio.finvault",
      "versionCode": 1
    }
  }
}
```

**eas.json:**
```json
{
  "cli": { "version": ">= 16.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-services.json",
        "track": "internal",
        "releaseStatus": "draft"
      }
    }
  }
}
```

> `serviceAccountKeyPath` points to a Google service-account JSON that must **never**
> be committed. Place the file at `apps/mobile/google-services.json` (gitignored) before
> running `eas submit`. The `releaseStatus: "draft"` creates a draft release on the
> internal track so you can review before publishing.

### 2.4 EAS Update: OTA updates (without a new store release)

After any JS-only change you can push an update without going through the Play Store again:

```bash
eas update --branch production --message "Bugfix transaction screen"
```

**What works via OTA, what doesn't:**
| Via OTA (JS-only) | Requires a new build |
|---|---|
| UI changes | New native packages |
| Bug fixes in screens | Permission changes |
| API endpoint changes | app.json changes |
| Copy/translations | New Expo plugins |

### 2.5 Development Client (recommended alternative to Expo Go)

Expo Go is limited (not every package is supported). Create a development build instead:

```bash
eas build --platform android --profile development
# Install the APK on your phone
# Now npx expo start works with ALL native packages
```

---

## 3. Backend & database self-hosting on a Linux VM

### 3.1 Overview of the stack the VM has to run

```
[Linux VM on your PC]
  ├── Docker Engine + Docker Compose
  ├── Nginx (reverse proxy + SSL termination)
  ├── Certbot (free SSL via Let's Encrypt)
  └── Docker containers:
       ├── finvault-gateway      :8000  ← exposed only through Nginx
       ├── finvault-account      :8001  ← internal
       ├── finvault-wallet       :8002  ← internal
       ├── finvault-invoice      :8003  ← internal
       ├── finvault-web-dashboard:3000  ← exposed through Nginx
       ├── finvault-rabbitmq     :5672/:15672 ← internal (never exposed!)
       └── finvault-dozzle       :8888  ← optional
```

### 3.2 Database options

**Current state:** SQLite per service — fine for dev, not for production.

| Option | Suited for | Pros | Cons |
|---|---|---|---|
| **SQLite** (current) | Dev/demo | Zero setup | No concurrent writes |
| **PostgreSQL** (recommended) | Production | Robust, Prisma support | Slightly more setup |
| **MySQL/MariaDB** | Production | Popular, Prisma support | Fewer features than PG |

**Prisma migration to PostgreSQL:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Adding a PostgreSQL container to docker-compose.yml:**
```yaml
  postgres:
    image: postgres:16-alpine
    container_name: finvault-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: finvault
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: finvault
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # NO external port exposure!
```

---

## 4. Network access: reachability from outside

This is the critical question: how does the mobile app (on the Play Store, on any
network) reach the backend on your home VM?

### Option A: Static IP + port forwarding

```
Internet → Router (port forward 80/443) → Linux VM → Nginx → Docker services
```

- Requires a static public IP or DynDNS
- Requires port forwarding on the router
- Your home IP becomes publicly visible
- Simple but less secure

### Option B: Cloudflare Tunnel ⭐ (recommended for home hosting)

```
Internet → Cloudflare Edge → Encrypted Tunnel → Cloudflared on VM → Nginx → Docker
```

```bash
cloudflared tunnel login
cloudflared tunnel create finvault
cloudflared tunnel route dns finvault api.finvault.com
cloudflared tunnel run finvault
```

**Pros:** no port forwarding, home IP hidden, free SSL, DDoS protection  
**Cons:** dependency on Cloudflare (the free tier is sufficient)

### Option C: VPN (Tailscale) — internal use

Only for yourself/testers who install the app, not for public Play Store users.

### Option D: External VPS

| Provider | Price | Specs |
|---|---|---|
| Hetzner CX22 | ~€4/month | 2 vCPU, 4GB RAM, 40GB SSD |
| DigitalOcean | ~€6/month | 1 vCPU, 1GB RAM, 25GB SSD |
| Contabo VPS S | ~€5/month | 4 vCPU, 6GB RAM, 200GB SSD |

---

## 5. What does the Linux VM need?

### 5.1 Minimum hardware requirements

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Storage | 20 GB | 50 GB |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

### 5.2 Software installation

```bash
# Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Nginx
sudo apt install nginx -y

# Certbot (SSL via Let's Encrypt)
sudo apt install certbot python3-certbot-nginx -y

# Cloudflared (Cloudflare Tunnel)
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# UFW Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 5.3 Nginx reverse proxy configuration

```nginx
server {
    listen 443 ssl;
    server_name api.finvault.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.finvault.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.finvault.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;   # WebSocket support
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 5.4 VM software options on Windows

| Option | Technology | Recommended for |
|---|---|---|
| **Hyper-V** (built-in) | Native hypervisor Win 10/11 Pro | Production-like 24/7 setup |
| **VMware Workstation Pro** | Commercial (now free) | Best performance |
| **VirtualBox** | Open source | Flexible, widely supported |
| **WSL2** | Windows Subsystem for Linux | Dev/testing, not ideal for 24/7 |

### 5.5 Production environment variables

```env
# Generate strong secrets: openssl rand -hex 32
JWT_SECRET=<strong_random_secret>
JWT_REFRESH_SECRET=<strong_random_secret>
FINVAULT_MESSAGE_KEY=<strong_random_secret>
SERVICE_SECRET=<strong_random_secret>

# PostgreSQL
POSTGRES_PASSWORD=<strong_password>
DATABASE_URL_ACCOUNT=postgresql://finvault:<pw>@postgres:5432/account_db
DATABASE_URL_WALLET=postgresql://finvault:<pw>@postgres:5432/wallet_db

# CORS — allow only your own domains
ALLOWED_ORIGINS=https://finvault.yourdomain.com
```

---

## 6. Overview of all possible approaches

### Approach 1: Fully self-hosted (your Linux VM) ⭐

```
PC → Linux VM → Docker → Nginx → Cloudflare Tunnel → api.finvault.com
```

- **Cost:** ~€10–15/year (domain name)
- **Uptime:** depends on your PC
- **Management:** entirely yourself

### Approach 2: Hybrid (backend on a cheap VPS)

```
Hetzner VPS → Docker → Nginx → Public IP → api.finvault.com
```

- **Cost:** ~€48–60/year
- **Uptime:** 99.9%
- **Management:** yourself, but on a more stable foundation

### Approach 3: Managed hosting (Railway, Render, Supabase)

- **Cost:** free tier available, then €5–20/month
- **Uptime:** 99.9%+
- **Management:** minimal

### Approach 4: Current (Expo Go + local backend)

- **Cost:** €0
- **Uptime:** local only
- **Suited for:** development & demo

---

## 7. Recommended approach (step by step)

### Phase 1: EAS development build (priority)

1. `npm install -g eas-cli`
2. `eas login` (create an Expo account on expo.dev)
3. Create `apps/mobile/eas.json` (see §2.3)
4. Add `android.package` to `apps/mobile/app.json`
5. `eas build --platform android --profile preview`
6. Download and install the APK → no more Expo Go needed!

### Phase 2: Set up the Linux VM

1. Install Hyper-V or VMware
2. Ubuntu 24.04 LTS VM (4GB RAM, 50GB)
3. Install Docker Engine
4. Adapt the existing `docker-compose.yml` for production
5. Set up a Cloudflare account + domain
6. Configure Cloudflare Tunnel + Nginx
7. Migrate SQLite → PostgreSQL (recommended)

### Phase 3: Connect the app to the hosted backend

1. `EXPO_PUBLIC_API_URL=https://api.yourdomain.com` in the build config
2. EAS preview build with the new URL
3. Test on a real phone against the real backend

### Phase 4: Play Store release

1. Google Play Developer account ($25 one-time)
2. `eas build --platform android --profile production`
3. Fill in the store listing (screenshots, description, Privacy Policy)
4. `eas submit --platform android`
5. Wait for Google review (1–3 days)

---

## 8. Pitfalls & points of attention

### Security
- **Never expose** RabbitMQ (5672/15672), PostgreSQL (5432) or internal services directly to the internet
- Use strong, unique secrets in production (replace the dev defaults)
- Configure CORS correctly in the gateway: only your own domains
- Replace the RabbitMQ `guest/guest` credentials for production
- Force HTTPS via Nginx (redirect HTTP → HTTPS)

### Mobile app
- `EXPO_PUBLIC_API_URL` **must be HTTPS** — Play Store apps may not use plain HTTP
- The WebSocket connection must also go over **WSS** (WebSocket Secure)
- The app has a demo mode when the backend is unreachable

### Database
- SQLite is fine for a demo, but **not** for multiple concurrent users
- Make regular backups (`pg_dump` for PostgreSQL)
- Use `prisma migrate deploy` in production, never `prisma db push` (resets data)

### Updates
- EAS Update for JS changes (no new store release needed)
- Native changes always require a new `eas build`
- `versionCode` in `app.json` must increase with every Play Store upload

### VM uptime
- If your PC is off or restarts, the VM is offline
- Consider a cheap VPS (Hetzner ~€4/month) for 24/7 availability

---

## Decision matrix summary

| Scenario | Best approach |
|---|---|
| Purely internal testing | Approach 4 + EAS development build |
| Showing a demo/portfolio | Approach 1 (VM) + Cloudflare Tunnel |
| Real users on the Play Store | Approach 2 (VPS) for reliability |
| Keeping it free | Approach 1 (VM) + Cloudflare Tunnel |
| Minimal management burden | Approach 3 (managed hosting) |

---

## 9. EAS GitHub integration & environment variables

> CI now triggers EAS builds itself via `.github/workflows/build-mobile.yml`
> (see [docs/ci-cd.md](ci-cd.md) §3); the expo.dev "Build from GitHub" UI below is the
> alternative if you prefer configuring it server-side on Expo's end.

### 9.1 Base directory (monorepo setting)

FinVault is a **monorepo** — the mobile app does NOT live in the root `/` but in a
subdirectory. Set this as the base directory on expo.dev:

```
apps/mobile
```

> This tells EAS that `app.json` and `eas.json` live in `apps/mobile/`,
> not in the root of the GitHub repo.

### 9.2 Filling in the "Build from GitHub" fields

| Field | Value | Explanation |
|---|---|---|
| **Git ref** | `dev` or `main` | Branch to build from. `dev` = your integration branch for testing, `main` = stable/production |
| **EAS Build profile** | `preview` (testing) or `production` (Play Store) | Defined in `apps/mobile/eas.json` |
| **Environment** | `preview` or `production` | Determines which EAS environment variables are included |
| **EAS Submit** | Leave empty for now | Only needed for automatic Play Store pushes after the build |
| **EAS Submit profile** | Leave empty for now | Fill in once EAS Submit is set up (#51) |

**Recommended flow:**
- Testing → branch `dev`, profile `preview`, environment `preview`
- Play Store → branch `main`, profile `production`, environment `production`

### 9.3 Setting environment variables on EAS

The mobile app currently has **1 configurable env variable**:

| Variable | Value today (hardcoded fallback) | Value for production |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://192.168.0.6:8000` (your LAN IP) | `https://api.yourdomain.com` |

**How to set it on expo.dev:**
1. Go to **expo.dev → tombomekestudios → FinVault → Environment Variables**
2. Click **Add variable**
3. Name: `EXPO_PUBLIC_API_URL`
4. Value: `https://api.yourdomain.com` (fill in once your backend is hosted, #52)
5. Visibility: **Public** (`EXPO_PUBLIC_` vars are baked into the app bundle)
6. Environment: `production`

> **Careful:** `EXPO_PUBLIC_` variables are visible in the compiled app bundle.
> NEVER put secrets in them (JWT keys, passwords) — those belong on the backend.
> The only env var the mobile app needs is the API URL.

### 9.4 Recommended EAS environments setup

| Environment | EXPO_PUBLIC_API_URL | When to use |
|---|---|---|
| `development` | `http://192.168.x.x:8000` (LAN) | Local testing with the dev client |
| `preview` | `http://192.168.x.x:8000` or tunneled URL | Internal APK testing |
| `production` | `https://api.yourdomain.com` | Play Store release |
