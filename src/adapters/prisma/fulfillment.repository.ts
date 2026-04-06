import { prisma } from "../../core/db/prisma.js";
import type { Order } from "../../domain/orders/order.js";
import type {
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
        }
      }
    });

    if (!order) {
      return null;
    }

    const record = order as unknown as OrderRecord;

    return {
      order: mapOrder(record),
      destinationCity: record.customer.city ?? undefined,
      lines: record.lines.map((line) => ({
        productOfferingId: line.productOfferingId,
        titleSnapshot: line.titleSnapshot,
        quantity: line.quantity
      }))
    };
  }
}
