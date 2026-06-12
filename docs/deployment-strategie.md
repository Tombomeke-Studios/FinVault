# FinVault — Deployment Strategie & Mogelijkheden

> Gedocumenteerd op: 2026-06-12  
> Scope: Mobile (Expo/EAS), Backend (Linux VM self-hosting), Web Dashboard

---

## Inhoudsopgave

1. [Situatieschets: hoe het nu werkt](#1-situatieschets-hoe-het-nu-werkt)
2. [Expo & EAS: van lokaal naar Play Store](#2-expo--eas-van-lokaal-naar-play-store)
3. [Backend & database self-hosting op Linux VM](#3-backend--database-self-hosting-op-linux-vm)
4. [Netwerktoegang: bereikbaarheid van buitenaf](#4-netwerktoegang-bereikbaarheid-van-buitenaf)
5. [Wat moet de Linux VM allemaal hebben?](#5-wat-moet-de-linux-vm-allemaal-hebben)
6. [Overzicht van alle mogelijke aanpakken](#6-overzicht-van-alle-mogelijke-aanpakken)
7. [Aanbevolen aanpak (stap voor stap)](#7-aanbevolen-aanpak-stap-voor-stap)
8. [Aandachtspunten & valkuilen](#8-aandachtspunten--valkuilen)

---

## 1. Situatieschets: hoe het nu werkt

```
[Jouw Windows PC]
  ├── apps/mobile        → npx expo start  (Expo Go / LAN)
  ├── apps/web-dashboard → http://localhost:3000
  └── services/*         → npm run dev  (gateway :8000, account :8001, wallet :8002, invoice :8003)
       └── RabbitMQ      → docker-compose (container)

[Jouw telefoon] ─── WiFi/LAN ──→ Expo Dev Server (QR-code scan)
```

**Huidige beperkingen:**
- De mobiele app werkt enkel via Expo Go (geen echte standalone APK/IPA).
- De backend is enkel bereikbaar via het lokale netwerk.
- De app kan niet worden gedeeld met anderen zonder dat zij ook op hetzelfde netwerk zitten.
- Er is een *demo mode* in de app als de backend niet bereikbaar is.

---

## 2. Expo & EAS: van lokaal naar Play Store

### 2.1 Wat is Expo vs. EAS?

| Tool | Rol |
|---|---|
| **Expo CLI** (`npx expo start`) | Lokale dev-server, Expo Go app, hot reload |
| **EAS Build** | Bouwt echte native APK/AAB (Android) of IPA (iOS) in de cloud |
| **EAS Submit** | Pusht de gebouwde app automatisch naar Google Play / Apple App Store |
| **EAS Update** | Over-the-air (OTA) updates: JS-code pushen zonder nieuwe store-release |

### 2.2 Flow: van code naar Play Store

```
1. Code klaar + eas.json geconfigureerd
        ↓
2. eas build --platform android --profile production
   → EAS servers bouwen een ondertekende .aab (Android App Bundle)
        ↓
3. Google Play Console (eenmalig account: ~€25)
   → App aanmaken, store listing invullen, Privacy Policy toevoegen
        ↓
4. eas submit --platform android
   → EAS laadt de .aab automatisch op naar Play Console
        ↓
5. Google review (typisch 1–3 dagen voor eerste release)
        ↓
6. App live op Play Store 🎉
```

### 2.3 Wat heb je nodig voor EAS?

**Verplicht:**
- **Expo-account** (gratis op expo.dev)
- **Google Play Developer-account** (eenmalige registratiekost: $25)
- **eas.json** in `apps/mobile/` met build-profielen
- **app.json** aanvullen met `android.package` (bijv. `com.tombomekestudio.finvault`)
- **Keystore** (ondertekeningscertificaat) — EAS genereert dit automatisch en slaat het veilig op

**app.json minimaal aanvullen voor Play Store:**
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

**eas.json (nieuw bestand in apps/mobile/):**
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
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### 2.4 EAS Update: OTA updates (zonder nieuwe store-release)

Na elke JS-codewijziging kun je een update pushen zonder de app opnieuw naar de Play Store te sturen:

```bash
eas update --branch production --message "Bugfix transactie scherm"
```

**Wat kan via OTA, wat niet:**
| Via OTA (JS-only) | Vereist nieuwe build |
|---|---|
| UI-wijzigingen | Nieuwe native packages |
| Bug fixes in schermen | Permissie-wijzigingen |
| API endpoint aanpassingen | app.json wijzigingen |
| Tekst/vertalingen | Nieuwe Expo plugins |

### 2.5 Development Client (aanbevolen alternatief voor Expo Go)

Expo Go is gelimiteerd (niet alle packages worden ondersteund). Maak een development build:

```bash
eas build --platform android --profile development
# Installeer de APK op je telefoon
# Nu werkt npx expo start met ALLE native packages
```

---

## 3. Backend & Database self-hosting op Linux VM

### 3.1 Overzicht van de stack die op de VM moet draaien

```
[Linux VM op jouw PC]
  ├── Docker Engine + Docker Compose
  ├── Nginx (reverse proxy + SSL termination)
  ├── Certbot (gratis SSL via Let's Encrypt)
  └── Docker containers:
       ├── finvault-gateway      :8000  ← enkel via Nginx naar buiten
       ├── finvault-account      :8001  ← intern
       ├── finvault-wallet       :8002  ← intern
       ├── finvault-invoice      :8003  ← intern
       ├── finvault-web-dashboard:3000  ← via Nginx naar buiten
       ├── finvault-rabbitmq     :5672/:15672 ← intern (nooit naar buiten!)
       └── finvault-dozzle       :8888  ← optioneel
```

### 3.2 Database opties

**Huidige staat:** SQLite per service — prima voor dev, niet voor productie.

| Optie | Geschikt voor | Voordelen | Nadelen |
|---|---|---|---|
| **SQLite** (huidig) | Dev/demo | Zero setup | Geen concurrent writes |
| **PostgreSQL** (aanbevolen) | Productie | Robuust, Prisma support | Iets meer setup |
| **MySQL/MariaDB** | Productie | Populair, Prisma support | Minder features dan PG |

**Prisma migratie naar PostgreSQL:**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**PostgreSQL container toevoegen aan docker-compose.yml:**
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
    # GEEN externe port exposure!
```

---

## 4. Netwerktoegang: bereikbaarheid van buitenaf

Dit is de kritieke vraag: hoe bereikt de mobiele app (op Play Store, op elk netwerk) de backend op jouw thuis-VM?

### Optie A: Statisch IP + Port Forwarding

```
Internet → Router (port forward 80/443) → Linux VM → Nginx → Docker services
```

- Vereist statisch publiek IP of DynDNS
- Vereist port forwarding in router
- Jouw thuis-IP wordt publiek zichtbaar
- Eenvoudig maar minder veilig

### Optie B: Cloudflare Tunnel ⭐ (aanbevolen voor thuis-hosting)

```
Internet → Cloudflare Edge → Encrypted Tunnel → Cloudflared op VM → Nginx → Docker
```

```bash
cloudflared tunnel login
cloudflared tunnel create finvault
cloudflared tunnel route dns finvault api.finvault.com
cloudflared tunnel run finvault
```

**Voordelen:** Geen port forwarding, thuis-IP verborgen, gratis SSL, DDoS-bescherming  
**Nadelen:** Afhankelijk van Cloudflare (gratis tier is voldoende)

### Optie C: VPN (Tailscale) — intern gebruik

Enkel voor jezelf/testers die de app installeren, niet voor publieke Play Store-gebruikers.

### Optie D: Externe VPS

| Provider | Prijs | Specs |
|---|---|---|
| Hetzner CX22 | ~€4/maand | 2 vCPU, 4GB RAM, 40GB SSD |
| DigitalOcean | ~€6/maand | 1 vCPU, 1GB RAM, 25GB SSD |
| Contabo VPS S | ~€5/maand | 4 vCPU, 6GB RAM, 200GB SSD |

---

## 5. Wat moet de Linux VM allemaal hebben?

### 5.1 Hardware minimumvereisten

| Resource | Minimum | Aanbevolen |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Opslag | 20 GB | 50 GB |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

### 5.2 Software installatie

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

### 5.3 Nginx reverse proxy configuratie

```nginx
server {
    listen 443 ssl;
    server_name api.finvault.jouwdomein.com;

    ssl_certificate /etc/letsencrypt/live/api.finvault.jouwdomein.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.finvault.jouwdomein.com/privkey.pem;

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

### 5.4 VM-software opties op Windows

| Optie | Technologie | Aanbevolen voor |
|---|---|---|
| **Hyper-V** (ingebouwd) | Native hypervisor Win 10/11 Pro | Productie-achtige 24/7 setup |
| **VMware Workstation Pro** | Commercieel (nu gratis) | Beste performance |
| **VirtualBox** | Open-source | Flexibel, breed ondersteund |
| **WSL2** | Windows Subsystem for Linux | Dev/testing, niet ideaal voor 24/7 |

### 5.5 Productie environment variabelen

```env
# Genereer sterke secrets: openssl rand -hex 32
JWT_SECRET=<sterk_random_secret>
JWT_REFRESH_SECRET=<sterk_random_secret>
FINVAULT_MESSAGE_KEY=<sterk_random_secret>
SERVICE_SECRET=<sterk_random_secret>

# PostgreSQL
POSTGRES_PASSWORD=<sterk_wachtwoord>
DATABASE_URL_ACCOUNT=postgresql://finvault:<pw>@postgres:5432/account_db
DATABASE_URL_WALLET=postgresql://finvault:<pw>@postgres:5432/wallet_db

# CORS — enkel jouw domeinen toelaten
ALLOWED_ORIGINS=https://finvault.jouwdomein.com
```

---

## 6. Overzicht van alle mogelijke aanpakken

### Aanpak 1: Volledig self-hosted (jouw Linux VM) ⭐

```
PC → Linux VM → Docker → Nginx → Cloudflare Tunnel → api.finvault.com
```

- **Kosten:** ~€10-15/jaar (domeinnaam)
- **Uptime:** Afhankelijk van jouw PC
- **Beheer:** Volledig zelf

### Aanpak 2: Hybride (backend op goedkope VPS)

```
Hetzner VPS → Docker → Nginx → Publiek IP → api.finvault.com
```

- **Kosten:** ~€48-60/jaar
- **Uptime:** 99.9%
- **Beheer:** Zelf, maar stabielere basis

### Aanpak 3: Managed hosting (Railway, Render, Supabase)

- **Kosten:** Gratis tier aanwezig, daarna €5-20/maand
- **Uptime:** 99.9%+
- **Beheer:** Minimaal

### Aanpak 4: Huidig (Expo Go + lokale backend)

- **Kosten:** €0
- **Uptime:** Enkel lokaal
- **Geschikt voor:** Development & demo

---

## 7. Aanbevolen aanpak (stap voor stap)

### Fase 1: EAS Development Build (prioriteit)

1. `npm install -g eas-cli`
2. `eas login` (maak Expo account aan op expo.dev)
3. Maak `apps/mobile/eas.json` aan (zie §2.3)
4. Voeg `android.package` toe in `apps/mobile/app.json`
5. `eas build --platform android --profile preview`
6. Download en installeer de APK → geen Expo Go meer nodig!

### Fase 2: Linux VM opzetten

1. Hyper-V of VMware installeren
2. Ubuntu 24.04 LTS VM (4GB RAM, 50GB)
3. Docker Engine installeren
4. Bestaande `docker-compose.yml` aanpassen voor productie
5. Cloudflare account + domein instellen
6. Cloudflare Tunnel + Nginx configureren
7. SQLite → PostgreSQL migreren (aanbevolen)

### Fase 3: App koppelen aan hosted backend

1. `EXPO_PUBLIC_API_URL=https://api.jouwdomein.com` in build-config
2. EAS preview build met nieuwe URL
3. Testen op echte telefoon via echte backend

### Fase 4: Play Store release

1. Google Play Developer account ($25 eenmalig)
2. `eas build --platform android --profile production`
3. Store listing invullen (screenshots, beschrijving, Privacy Policy)
4. `eas submit --platform android`
5. Wachten op Google review (1-3 dagen)

---

## 8. Aandachtspunten & valkuilen

### Security
- **Expose nooit** RabbitMQ (5672/15672), PostgreSQL (5432) of interne services direct naar internet
- Gebruik sterke, unieke secrets voor productie (vervang dev-defaults)
- Stel CORS correct in in de gateway: enkel jouw domeinen
- Vervang RabbitMQ `guest/guest` credentials voor productie
- Forceer HTTPS via Nginx (redirect HTTP → HTTPS)

### Mobile app
- De `EXPO_PUBLIC_API_URL` **moet HTTPS** zijn — Play Store apps mogen geen plain HTTP gebruiken
- WebSocket verbinding moet ook via **WSS** (WebSocket Secure)
- De app heeft een demo mode als backend niet bereikbaar is

### Database
- SQLite is prima voor demo, maar **niet** voor meerdere gelijktijdige gebruikers
- Maak regelmatige backups (`pg_dump` voor PostgreSQL)
- Gebruik `prisma migrate deploy` in productie, nooit `prisma db push` (reset data)

### Updates
- EAS Update voor JS-wijzigingen (geen nieuwe store release nodig)
- Native wijzigingen vereisen altijd een nieuwe `eas build`
- `versionCode` in `app.json` moet bij elke Play Store upload hoger zijn

### VM uptime
- Als jouw PC uit staat of herstart, is de VM offline
- Overweeg een goedkope VPS (Hetzner ~€4/maand) voor 24/7 beschikbaarheid

---

## Samenvatting beslissingsmatrix

| Scenario | Beste aanpak |
|---|---|
| Puur intern testen | Aanpak 4 + EAS development build |
| Demo/portfolio tonen | Aanpak 1 (VM) + Cloudflare Tunnel |
| Echte gebruikers op Play Store | Aanpak 2 (VPS) voor betrouwbaarheid |
| Gratis houden | Aanpak 1 (VM) + Cloudflare Tunnel |
| Minimale beheerlast | Aanpak 3 (managed hosting) |

---

## 9. EAS GitHub-integratie & Environment Variables

### 9.1 Base directory (monorepo instelling)

FinVault is een **monorepo** — de mobile app zit NIET in de root `/` maar in een submap.
Stel dit in als base directory op expo.dev:

```
apps/mobile
```

> Dit vertelt EAS dat de `app.json` en `eas.json` in `apps/mobile/` staan,
> niet in de root van de GitHub repo.

### 9.2 "Build from GitHub" velden invullen

| Veld | Waarde | Uitleg |
|---|---|---|
| **Git ref** | `dev` of `main` | Branch om van te bouwen. `dev` = jouw integratiebranch voor testen, `main` = stable/productie |
| **EAS Build profile** | `preview` (voor testen) of `production` (voor Play Store) | Staat gedefinieerd in `apps/mobile/eas.json` |
| **Environment** | `preview` of `production` | Bepaalt welke EAS-omgevingsvariabelen worden meegenomen |
| **EAS Submit** | Leeg laten voor nu | Alleen nodig als je automatisch naar Play Store wil pushen na de build |
| **EAS Submit profile** | Leeg laten voor nu | Pas invullen als je EAS Submit instelt |

**Aanbevolen flow:**
- Testen → branch `dev`, profile `preview`, environment `preview`
- Play Store → branch `main`, profile `production`, environment `production`

### 9.3 Environment Variables op EAS instellen

De mobiele app heeft momenteel **1 configureerbare env variabele**:

| Variabele | Waarde nu (hardcoded fallback) | Waarde voor productie |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://192.168.0.6:8000` (jouw LAN IP) | `https://api.jouwdomein.com` |

**Hoe instellen op expo.dev:**
1. Ga naar **expo.dev → tombomekestudios → FinVault → Environment Variables**
2. Klik **Add variable**
3. Naam: `EXPO_PUBLIC_API_URL`
4. Waarde: `https://api.jouwdomein.com` (pas in zodra je backend gehost is)
5. Visibility: **Public** (EXPO_PUBLIC_ vars worden ingebakken in de app bundle)
6. Environment: `production`

> **Let op:** `EXPO_PUBLIC_` variabelen zijn zichtbaar in de gecompileerde app-bundle.
> Zet hier NOOIT secrets (JWT keys, wachtwoorden) in — die horen op de backend.
> De enige env var die de mobile app nodig heeft is de API URL.

### 9.4 Aanbevolen EAS environments setup

| Environment | EXPO_PUBLIC_API_URL | Wanneer gebruiken |
|---|---|---|
| `development` | `http://192.168.x.x:8000` (LAN) | Lokaal testen met dev client |
| `preview` | `http://192.168.x.x:8000` of tunneled URL | Interne APK testen |
| `production` | `https://api.jouwdomein.com` | Play Store release |
