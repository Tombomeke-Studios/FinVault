-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN "externalReference" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN "externalNotifiedAt" DATETIME;

-- CreateIndex
CREATE INDEX "PaymentRequest_externalReference_idx" ON "PaymentRequest"("externalReference");
