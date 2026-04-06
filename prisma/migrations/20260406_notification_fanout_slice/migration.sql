CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "NotificationRecipientRole" AS ENUM ('CUSTOMER', 'OPERATOR');

CREATE TABLE "NotificationLog" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "recipientRole" "NotificationRecipientRole" NOT NULL,
  "recipientAddress" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "eventIdempotencyKey" TEXT NOT NULL,
  "notificationKey" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "providerPayloadJson" JSONB,
  "failureMessage" TEXT,
  "dispatchedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationLog_notificationKey_key" ON "NotificationLog"("notificationKey");
CREATE INDEX "NotificationLog_sellerId_createdAt_idx" ON "NotificationLog"("sellerId", "createdAt");
CREATE INDEX "NotificationLog_orderId_createdAt_idx" ON "NotificationLog"("orderId", "createdAt");
CREATE INDEX "NotificationLog_status_createdAt_idx" ON "NotificationLog"("status", "createdAt");

ALTER TABLE "NotificationLog"
ADD CONSTRAINT "NotificationLog_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationLog"
ADD CONSTRAINT "NotificationLog_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
