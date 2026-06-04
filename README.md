# FinVault

Microservices-driven banking and wallet platform.

[![Architecture](assets/badges/architecture.svg)](https://github.com/tombomeke-studio/FinVault)
[![Language](assets/badges/language.svg)](https://github.com/tombomeke-studio/FinVault)
[![Database](assets/badges/database.svg)](https://github.com/tombomeke-studio/FinVault)
[![CI/CD](assets/badges/pipeline.svg)](https://github.com/tombomeke-studio/FinVault)
[![Deploy](assets/badges/deploy.svg)](https://github.com/tombomeke-studio/FinVault)

---

## Overzicht

FinVault is een high-end, event-driven banking platform ontworpen voor maximale schaalbaarheid en robuustheid. Het maakt gebruik van een gedecoupleerde microservices-architectuur waarbij services asynchroon met elkaar communiceren via events (RabbitMQ) en live updates via WebSockets naar de web-dashboard cliënt pushen.

---

## Project Structuur

De repository is opgezet als een monorepo met duidelijke servicegrenzen:

```
FinVault/
├── apps/
│   └── web-dashboard/           # React + Vite frontend (Vliegt op eigen poort/image)
├── services/
│   ├── gateway/                 # API Gateway + WebSocket Event Hub (Centraal startpunt)
│   ├── account-service/         # Identity & Authentication Service (Prisma + SQLite, JWT)
│   └── wallet-transaction-service/ # Ledger, Saldo's & P2P transactie verwerking
├── shared/                      # Gedeelde TypeScript types en Event definities
├── docker-compose.yml           # Multi-container orchestration (RabbitMQ + Services)
└── package.json                 # Monorepo root config
```

---

## Technische Architectuur

### 1. API Gateway & WebSocket Hub
De Gateway fungeert als het single entrypoint voor de frontend en mobiele apps. Tevens draait het een WebSocket-server die actieve gebruikerssessies koppelt en real-time balance- en transaction-alerts direct op het scherm tovert.

### 2. Account Service
Verantwoordelijk voor authenticatie, registratie (inclusief profielcreatie en master UUID-toewijzing) en audit-logging van beveiligingsgebeurtenissen. Wachtwoorden worden gehasht met bcrypt en sessies worden beheerd via beveiligde JWT-tokens.

### 3. Wallet & Transaction Service
De financiële kern van het systeem. Transacties worden verwerkt via een double-entry ledger principe (gelijktijdige debitering en creditering) verpakt in atomaire database-transacties. Bevat tevens automatische duplicaat-detectie binnen 30 seconden.

---

## Database Configuratie (SQLite naar Production DB)

Voor een directe en frictieloze lokale start maakt FinVault momenteel gebruik van **SQLite** databases (`account.db` en `wallet.db`), beheerd via Prisma ORM.

### Migreren naar PostgreSQL / MySQL (Productie)
Wanneer de applicatie via Docker op een VM of Kubernetes wordt gehost, kan er eenvoudig een aparte, centrale database container (bijv. PostgreSQL) worden gespind. Dankzij Prisma vereist dit geen codewijzigingen:

1. Open het schema bestand van de gewenste service, bijv. `services/account-service/prisma/schema.prisma`.
2. Pas de `datasource db` configuratie aan:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Voeg de `DATABASE_URL` omgevingsvariabele toe aan je Docker environment config.
4. Voer de migratie uit: `npx prisma db push`.

---

## Lokale Test-Links & Inloggegevens

Om het testen van FinVault zo soepel en realistisch mogelijk te maken, zijn er verschillende lokale dashboards en pre-seeded inloggegevens beschikbaar.

### 🔑 Pre-Seeded Test-Accounts
Er zijn bij de startup van de `account-service` automatisch twee accounts gegenereerd. Deze accounts zijn direct klaar voor gebruik:

#### 💼 Business / Administrator Account
- **E-mailadres:** `admin@finvault.com`
- **Wachtwoord:** `admin123`

#### 👤 Personal / Consumer Account
- **E-mailadres:** `test@finvault.com`
- **Wachtwoord:** `test123`

> [!TIP]
> Log in met een van deze accounts in het Web Dashboard of de Mobiele App om direct toegang te krijgen tot een volledig functioneel account met een automatisch gegenereerd IBAN-nummer, startkrediet en real-time synchroniserende bankpassen en spaardoelen.

### 🔗 Handige Test-Links

| Service / Dashboard | URL | Beschrijving / Credentials |
| :--- | :--- | :--- |
| **Web Dashboard** | [http://localhost:3000](http://localhost:3000) | De React + Vite frontend cliënt voor interactie. |
| **Dozzle Log Monitor** | [http://localhost:8888](http://localhost:8888) | Premium web-dashboard om real-time containerlogs te bekijken. |
| **RabbitMQ Management** | [http://localhost:15672](http://localhost:15672) | Event Hub management dashboard. (User: `guest` / Pass: `guest`) |
| **API Gateway** | [http://localhost:8000](http://localhost:8000) | Centraal startpunt voor alle REST & WebSocket API-verzoeken. |
| **Account Service** | [http://localhost:8001](http://localhost:8001) | Identity & Authentication Service REST API. |
| **Wallet Service** | [http://localhost:8002](http://localhost:8002) | Ledger, Saldo's & P2P transactie verwerking REST API. |
| **Invoice Service** | [http://localhost:8003](http://localhost:8003) | Kwitanties (PDF), Betalingsverzoeken & Mandaten REST API. |

---

## Lokaal Starten

### 1. Voorbereiding
Zorg dat Node.js (v18+) is geïnstalleerd.

```bash
# Installeer alle dependencies in de monorepo
npm install

# Push database schema's naar lokale SQLite databases
npx prisma db push --schema=services/account-service/prisma/schema.prisma
npx prisma db push --schema=services/wallet-transaction-service/prisma/schema.prisma
```

### 2. Alles tegelijk starten (Dev Mode)
De monorepo is uitgerust met een gecentraliseerd startscript dat alle services en het web-dashboard tegelijkertijd start:

```bash
npm run dev
```

De applicatie is nu bereikbaar op:
- Web Dashboard: [http://localhost:3000](http://localhost:3000)
- API Gateway: [http://localhost:8000](http://localhost:8000)

### 3. Unit en Integratietesten Uitvoeren
```bash
npm test
```

### 4. Mobiele App Starten (Expo Go)
De mobiele applicatie is gebouwd met React Native en Expo. Je kunt deze eenvoudig lokaal starten en openen op je eigen smartphone via de Expo Go app:

1. Zorg ervoor dat je de **Expo Go** app hebt geïnstalleerd op je iOS- of Android-toestel (verkrijgbaar in de App Store of Google Play Store).
2. Start de Expo server vanuit de root van de monorepo:
   ```bash
   npm run dev:mobile
   ```
   *(Alternatief: navigeer naar `apps/mobile` en voer `npx expo start` of `npm start` uit).*
3. Er verschijnt een QR-code in de terminal.
4. Scan de QR-code met de camera van je iPhone of via de Expo Go app op Android om de app direct op je telefoon te openen!

---

## Docker Deployment

Elke service en het web-dashboard zijn volledig voorbereid op Docker. Je kunt de hele stack in één keer opzetten via Docker Compose (inclusief ingebouwde RabbitMQ broker):

```bash
# Bouw en start de gehele infrastructuur
docker-compose up --build -d
```
