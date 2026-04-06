import { prisma } from "../../core/db/prisma.js";
import type { FulfillmentRecord, Order } from "../../domain/orders/order.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type {
  FulfillmentDeliveryContext,
  FulfillmentRepository,
  FulfillmentShipmentContext
} from "../../ports/fulfillment-repository.js";

type OrderRecord = {
  id: string;
  sellerId: string;
  customerId: string;
  orderNumber: string;
  mode: string;
  status: string;
  paymentPolicy: string;
  paymentStatus: string;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  currency: string;
  reservationExpiresAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: {
    city: string | null;
  };
  lines: Array<{
    productOfferingId: string;
    titleSnapshot: string;
    quantity: number;
  }>;
  fulfillmentRecord?: {
    id: string;
    sellerId: string;
    orderId: string;
    status: string;
    bookingReference: string | null;
    courierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    rawPayloadJson: unknown;
    handedOffAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

function mapOrder(record: OrderRecord): Order {
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
    reservationExpiresAt: record.reservationExpiresAt?.toISOString(),
    notes: record.notes ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapFulfillmentRecord(
  record: NonNullable<OrderRecord["fulfillmentRecord"]>
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
    rawPayload:
      ((record.rawPayloadJson as KeyValueRecord | null) ?? undefined) as
        | KeyValueRecord
        | undefined,
    handedOffAt: record.handedOffAt?.toISOString(),
    deliveredAt: record.deliveredAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export class PrismaFulfillmentRepository implements FulfillmentRepository {
  async getShipmentContext(orderId: string): Promise<FulfillmentShipmentContext | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            city: true
          }
        },
        lines: {
          select: {
            productOfferingId: true,
            titleSnapshot: true,
            quantity: true
          }
        },
        fulfillmentRecord: true
      }
    });

    if (!order) {
      return null;
    }

    const record = order as unknown as OrderRecord;

    return {
      order: mapOrder(record),
      destinationCity: record.customer.city ?? undefined,
      fulfillmentRecord: record.fulfillmentRecord
        ? mapFulfillmentRecord(record.fulfillmentRecord)
        : undefined,
      lines: record.lines.map((line) => ({
        productOfferingId: line.productOfferingId,
        titleSnapshot: line.titleSnapshot,
        quantity: line.quantity
      }))
    };
  }

  async getDeliveryContext(orderId: string): Promise<FulfillmentDeliveryContext | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        fulfillmentRecord: true
      }
    });

    if (!order) {
      return null;
    }

    const record = order as unknown as OrderRecord;

    return {
      order: mapOrder(record),
      fulfillmentRecord: record.fulfillmentRecord
        ? mapFulfillmentRecord(record.fulfillmentRecord)
        : undefined
    };
  }
}
