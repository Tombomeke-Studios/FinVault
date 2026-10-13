-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN "externalReference" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN "externalNotifiedAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRequest_externalReference_key" ON "PaymentRequest"("externalReference");
