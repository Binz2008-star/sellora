ALTER TABLE "NotificationLog"
ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN "acknowledgedBySellerId" TEXT;

CREATE INDEX "NotificationLog_sellerId_acknowledgedAt_createdAt_idx"
ON "NotificationLog"("sellerId", "acknowledgedAt", "createdAt");
