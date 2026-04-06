import type { AuditStamp, EntityId, KeyValueRecord, Money } from "../shared/types.js";

export type PaymentAttemptStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "refunded";

export interface PaymentAttempt extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  orderId: EntityId;
  provider: string;
  providerReference?: string;
  idempotencyKey?: string;
  status: PaymentAttemptStatus;
  amount: Money;
  metadata?: KeyValueRecord;
  rawPayload?: KeyValueRecord;
}

export type PaymentEventType =
  | "payment_initiated"
  | "payment_processing"
  | "payment_succeeded"
  | "payment_failed"
  | "payment_refunded";

export function isTerminalPaymentStatus(status: PaymentAttemptStatus): boolean {
  return status === "paid" || status === "failed" || status === "refunded";
}
