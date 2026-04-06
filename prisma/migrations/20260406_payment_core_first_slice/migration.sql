ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TABLE "PaymentAttempt"
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "PaymentAttempt_sellerId_idempotencyKey_key"
ON "PaymentAttempt"("sellerId", "idempotencyKey");
