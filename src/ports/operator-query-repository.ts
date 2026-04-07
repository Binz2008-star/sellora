import type { Order, OrderLine, FulfillmentRecord } from "../domain/orders/order.js";
import type { OperatorNotificationSummary } from "./notification-query-repository.js";
import type { PaymentAttempt } from "../domain/payments/payment.js";
import type { KeyValueRecord } from "../domain/shared/types.js";
import type { StorefrontSettings } from "../domain/tenancy/seller.js";

export interface OperatorOrderDetail {
  order: Order;
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    city?: string;
    addressText?: string;
  };
  lines: OrderLine[];
}

export interface OperatorOrderTimelineEntry {
  id: string;
  eventType: string;
  payload?: KeyValueRecord;
  createdAt: string;
}

export interface OperatorShippingWebhookReceipt {
  id: string;
  provider: string;
  eventType: string;
  idempotencyKey: string;
  providerReference?: string;
  trackingNumber?: string;
  normalizedStatus: string;
  rawPayload: KeyValueRecord;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperatorQueryRepository {
  getSellerStorefrontSettings(sellerId: string): Promise<StorefrontSettings | null>;
  getOrderDetail(orderId: string): Promise<OperatorOrderDetail | null>;
  listPaymentAttempts(orderId: string): Promise<PaymentAttempt[]>;
  getFulfillment(orderId: string): Promise<FulfillmentRecord | null>;
  listOrderTimeline(orderId: string): Promise<OperatorOrderTimelineEntry[]>;
  listShippingWebhookReceipts(orderId: string): Promise<OperatorShippingWebhookReceipt[]>;
  listNotificationsByOrder(orderId: string): Promise<OperatorNotificationSummary[]>;
}
