-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionRef" TEXT NOT NULL,
    "payerUserId" TEXT NOT NULL,
    "payeeUserId" TEXT,
    "payerEmail" TEXT NOT NULL,
    "payeeEmail" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT NOT NULL,
    "pdfPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creatorUserId" TEXT NOT NULL,
    "creatorEmail" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME,
    "paidAt" DATETIME,
    "transactionRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Mandate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payerUserId" TEXT NOT NULL,
    "payerEmail" TEXT NOT NULL,
    "payeeUserId" TEXT NOT NULL,
    "payeeEmail" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "description" TEXT NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'active',
    "nextChargeAt" DATETIME NOT NULL,
    "lastChargedAt" DATETIME,
    "totalCharged" REAL NOT NULL DEFAULT 0.0,
    "chargeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_transactionRef_key" ON "Receipt"("transactionRef");
