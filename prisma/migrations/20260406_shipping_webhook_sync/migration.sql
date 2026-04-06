ALTER TABLE IF EXISTS "FulfillmentRecord"
ADD COLUMN IF NOT EXISTS "providerStatus" TEXT,
ADD COLUMN IF NOT EXISTS "lastWebhookAt" TIMESTAMP(3);

CREATE TABLE "ShippingWebhookReceipt" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT,
  "provider" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "providerReference" TEXT,
  "trackingNumber" TEXT,
  "normalizedStatus" TEXT NOT NULL,
  "orderId" TEXT,
  "rawPayloadJson" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingWebhookReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShippingWebhookReceipt_idempotencyKey_key"
ON "ShippingWebhookReceipt"("idempotencyKey");

CREATE INDEX "ShippingWebhookReceipt_provider_providerReference_idx"
ON "ShippingWebhookReceipt"("provider", "providerReference");

CREATE INDEX "ShippingWebhookReceipt_provider_trackingNumber_idx"
ON "ShippingWebhookReceipt"("provider", "trackingNumber");

CREATE INDEX "ShippingWebhookReceipt_orderId_idx"
ON "ShippingWebhookReceipt"("orderId");

ALTER TABLE "ShippingWebhookReceipt"
ADD CONSTRAINT "ShippingWebhookReceipt_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;
