import type { KeyValueRecord } from "../domain/shared/types.js";
import type { Order } from "../domain/orders/order.js";
import type {
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentEventType
} from "../domain/payments/payment.js";
import type { RepositoryTransaction } from "./repository-transaction.js";

export interface PaymentAttemptContext {
  attempt: PaymentAttempt;
  order: Order;
}

export interface CreatePaymentAttemptInput {
  sellerId: string;
  orderId: string;
  provider: string;
  amountMinor: number;
  currency: string;
  idempotencyKey?: string;
  metadata?: KeyValueRecord;
  rawPayload?: KeyValueRecord;
}

export interface UpdatePaymentAttemptStatusInput {
  paymentAttemptId: string;
  expectedCurrentStatus: PaymentAttemptStatus;
  nextStatus: PaymentAttemptStatus;
  providerReference?: string;
  metadata?: KeyValueRecord;
  rawPayload?: KeyValueRecord;
  eventType: PaymentEventType;
}

export interface PaymentRepository {
  withTransaction<T>(work: (transaction: RepositoryTransaction) => Promise<T>): Promise<T>;
  findAttemptContextById(
    paymentAttemptId: string,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext | null>;
  findAttemptContextByIdempotencyKey(
    sellerId: string,
    idempotencyKey: string,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext | null>;
  findAttemptContextByProviderReference(
    provider: string,
    providerReference: string,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext | null>;
  findActiveAttemptForOrder(
    orderId: string,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext | null>;
  createAttempt(
    input: CreatePaymentAttemptInput,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext>;
  updateAttemptStatus(
    input: UpdatePaymentAttemptStatusInput,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext>;
}
