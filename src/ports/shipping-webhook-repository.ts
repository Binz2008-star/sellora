import type { KeyValueRecord } from "../domain/shared/types.js";
import type { RepositoryTransaction } from "./repository-transaction.js";

export interface ShippingWebhookReceiptInput {
  sellerId?: string;
  provider: string;
  eventType: string;
  idempotencyKey: string;
  providerReference?: string;
  trackingNumber?: string;
  normalizedStatus: string;
  orderId?: string;
  rawPayload: KeyValueRecord;
  receivedAt: string;
}

export interface ShippingWebhookReceiptResult {
  duplicate: boolean;
}

export interface ShippingWebhookRepository {
  withTransaction<T>(work: (transaction: RepositoryTransaction) => Promise<T>): Promise<T>;
  recordReceipt(
    input: ShippingWebhookReceiptInput,
    transaction?: RepositoryTransaction
  ): Promise<ShippingWebhookReceiptResult>;
}
