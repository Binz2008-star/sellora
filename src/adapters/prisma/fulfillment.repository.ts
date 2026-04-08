import { Prisma } from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type { FulfillmentRecord, Order } from "../../domain/orders/order.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import { getRuntimeClient } from "../../integration/runtime-client/index.js";
import type {
  FulfillmentDeliveryContext,
  FulfillmentRepository,
  FulfillmentShipmentContext,
  ShippingWebhookContext,
  UpsertProviderStatusInput
} from "../../ports/fulfillment-repository.js";
import type { RepositoryTransaction } from "../../ports/repository-transaction.js";

type FulfillmentRecordRow = {
  id: string;
  sellerId: string;
  orderId: string;
  status: string;
  bookingReference: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  providerStatus: string | null;
  rawPayloadJson: unknown;
  lastWebhookAt: Date | null;
  handedOffAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapOrder(record: any): Order {
  return {
    id: record.id,
    sellerId: record.sellerId,
    customerId: record.customerId,
    orderNumber: record.orderNumber,
    mode: record.mode.toLowerCase().replace("_", "-") as Order["mode"],
    paymentPolicy: record.paymentPolicy.toLowerCase().replace(/_/g, "-") as Order["paymentPolicy"],
    status: record.status.toLowerCase() as Order["status"],
    paymentStatus: record.paymentStatus.toLowerCase() as Order["paymentStatus"],
    subtotal: {
      amountMinor: record.subtotalMinor,
      currency: record.currency
    },
    deliveryFee:
      record.deliveryFeeMinor > 0
        ? {
            amountMinor: record.deliveryFeeMinor,
            currency: record.currency
          }
        : undefined,
    total: {
      amountMinor: record.totalMinor,
      currency: record.currency
    },
    reservationExpiresAt: record.reservationExpiresAt,
    notes: record.notes ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function mapFulfillmentRecord(
  record: FulfillmentRecordRow
): FulfillmentRecord {
  return {
    id: record.id,
    sellerId: record.sellerId,
    orderId: record.orderId,
    status: record.status.toLowerCase() as FulfillmentRecord["status"],
    bookingReference: record.bookingReference ?? undefined,
    courierName: record.courierName ?? undefined,
    trackingNumber: record.trackingNumber ?? undefined,
    trackingUrl: record.trackingUrl ?? undefined,
    providerStatus: record.providerStatus ?? undefined,
    rawPayload:
      ((record.rawPayloadJson as KeyValueRecord | null) ?? undefined) as
        | KeyValueRecord
        | undefined,
    lastWebhookAt: record.lastWebhookAt?.toISOString(),
    handedOffAt: record.handedOffAt?.toISOString(),
    deliveredAt: record.deliveredAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export class PrismaFulfillmentRepository implements FulfillmentRepository {
  async findWebhookContext(
    lookup: {
      providerReference?: string;
      trackingNumber?: string;
    },
    transaction?: RepositoryTransaction
  ): Promise<ShippingWebhookContext | null> {
    if (!lookup.providerReference && !lookup.trackingNumber) {
      return null;
    }

    const client = (transaction as any) ?? prisma;
    const orClauses: Prisma.FulfillmentRecordWhereInput[] = [];
    if (lookup.providerReference) {
      orClauses.push({ bookingReference: lookup.providerReference });
    }
    if (lookup.trackingNumber) {
      orClauses.push({ trackingNumber: lookup.trackingNumber });
    }
    const fulfillment = await client.fulfillmentRecord.findFirst({
      where: {
        OR: orClauses
      }
    });

    if (!fulfillment) {
      return null;
    }

    const runtimeOrder = await getRuntimeClient().getOrder(fulfillment.orderId);

    return {
      order: mapOrder(runtimeOrder),
      fulfillmentRecord: mapFulfillmentRecord(fulfillment as FulfillmentRecordRow)
    };
  }

  async updateProviderStatus(
    input: UpsertProviderStatusInput,
    transaction?: RepositoryTransaction
  ): Promise<FulfillmentRecord> {
    const client = (transaction as any) ?? prisma;
    const updated = await client.fulfillmentRecord.update({
      where: {
        id: input.fulfillmentRecordId
      },
      data: {
        providerStatus: input.providerStatus,
        bookingReference: input.providerReference,
        trackingNumber: input.trackingNumber,
        trackingUrl: input.trackingUrl,
        courierName: input.courierName,
        rawPayloadJson: input.rawPayload,
        lastWebhookAt: new Date(input.receivedAt)
      }
    });

    return mapFulfillmentRecord(updated as FulfillmentRecordRow);
  }

  async getShipmentContext(
    orderId: string,
    transaction?: RepositoryTransaction
  ): Promise<FulfillmentShipmentContext | null> {
    const client = (transaction as any) ?? prisma;
    
    const runtimeOrder = await getRuntimeClient().getOrder(orderId);
    if (!runtimeOrder) {
      return null;
    }

    const fulfillmentRecord = await client.fulfillmentRecord.findFirst({
      where: { orderId }
    });

    return {
      order: mapOrder(runtimeOrder),
      destinationCity: runtimeOrder.customer?.city ?? undefined,
      fulfillmentRecord: fulfillmentRecord
        ? mapFulfillmentRecord(fulfillmentRecord as FulfillmentRecordRow)
        : undefined,
      lines: (runtimeOrder.lines ?? []).map((line: any) => ({
        productOfferingId: line.productOfferingId,
        titleSnapshot: line.titleSnapshot,
        quantity: line.quantity
      }))
    };
  }

  async getDeliveryContext(
    orderId: string,
    transaction?: RepositoryTransaction
  ): Promise<FulfillmentDeliveryContext | null> {
    const client = (transaction as any) ?? prisma;
    
    const runtimeOrder = await getRuntimeClient().getOrder(orderId);
    if (!runtimeOrder) {
      return null;
    }

    const fulfillmentRecord = await client.fulfillmentRecord.findFirst({
      where: { orderId }
    });

    return {
      order: mapOrder(runtimeOrder),
      fulfillmentRecord: fulfillmentRecord
        ? mapFulfillmentRecord(fulfillmentRecord as FulfillmentRecordRow)
        : undefined
    };
  }
}
