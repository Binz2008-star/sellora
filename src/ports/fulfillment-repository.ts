import type { KeyValueRecord } from "../domain/shared/types.js";
import type { FulfillmentRecord, Order } from "../domain/orders/order.js";
import type { RepositoryTransaction } from "./repository-transaction.js";

export interface FulfillmentShipmentLine {
  productOfferingId: string;
  titleSnapshot: string;
  quantity: number;
}

export interface FulfillmentShipmentContext {
  order: Order;
  destinationCity?: string;
  fulfillmentRecord?: FulfillmentRecord;
  lines: FulfillmentShipmentLine[];
}

export interface FulfillmentDeliveryContext {
  order: Order;
  fulfillmentRecord?: FulfillmentRecord;
}

export interface ShippingWebhookContext {
  order: Order;
  fulfillmentRecord: FulfillmentRecord;
}

export interface UpsertProviderStatusInput {
  fulfillmentRecordId: string;
  providerStatus: string;
  providerReference?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  courierName?: string;
  rawPayload: KeyValueRecord;
  receivedAt: string;
}

export interface FulfillmentRepository {
  getShipmentContext(
    orderId: string,
    transaction?: RepositoryTransaction
  ): Promise<FulfillmentShipmentContext | null>;
  getDeliveryContext(
    orderId: string,
    transaction?: RepositoryTransaction
  ): Promise<FulfillmentDeliveryContext | null>;
  findWebhookContext(
    lookup: {
      providerReference?: string;
      trackingNumber?: string;
    },
    transaction?: RepositoryTransaction
  ): Promise<ShippingWebhookContext | null>;
  updateProviderStatus(
    input: UpsertProviderStatusInput,
    transaction?: RepositoryTransaction
  ): Promise<FulfillmentRecord>;
}
