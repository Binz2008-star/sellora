import { prisma } from "../../core/db/prisma.js";
import type { FulfillmentRecord, Order, OrderLine } from "../../domain/orders/order.js";
import type { PaymentAttempt } from "../../domain/payments/payment.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type { OperatorNotificationSummary } from "../../ports/notification-query-repository.js";
import type {
  OperatorOrderDetail,
  OperatorOrderTimelineEntry,
  OperatorQueryRepository,
  OperatorShippingWebhookReceipt
} from "../../ports/operator-query-repository.js";

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
};

type OrderLineRecord = {
  id: string;
  orderId: string;
  productId: string;
  productOfferingId: string;
  titleSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  costPriceMinor: number;
  currencySnapshot: string;
  selectedAttributesSnapshot: unknown;
  lineTotalMinor: number;
  createdAt: Date;
};

type PaymentAttemptRecord = {
  id: string;
  sellerId: string;
  orderId: string;
  provider: string;
  providerReference: string | null;
  idempotencyKey: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  metadataJson: unknown;
  rawPayloadJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type FulfillmentRecordRecord = {
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

type NotificationRecord = {
  id: string;
  sellerId: string;
  orderId: string;
  channel: string;
  status: string;
  recipientRole: string;
  recipientAddress: string;
  templateKey: string;
  eventType: string;
  eventIdempotencyKey: string;
  notificationKey: string;
  subject: string;
  body: string;
  providerMessageId: string | null;
  providerPayloadJson: unknown;
  failureMessage: string | null;
  dispatchedAt: Date | null;
  acknowledgedAt: Date | null;
  acknowledgedBySellerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  order: {
    orderNumber: string;
  };
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

function mapOrderLine(record: OrderLineRecord, currency: string): OrderLine {
  return {
    id: record.id,
    orderId: record.orderId,
    productId: record.productId,
    productOfferingId: record.productOfferingId,
    titleSnapshot: record.titleSnapshot,
    quantity: record.quantity,
    unitPrice: {
      amountMinor: record.unitPriceMinor,
      currency
    },
    costPrice: {
      amountMinor: record.costPriceMinor,
      currency
    },
    currencySnapshot: record.currencySnapshot,
    selectedAttributesSnapshot: (record.selectedAttributesSnapshot as Record<string, unknown>) ?? {},
    lineTotal: {
      amountMinor: record.lineTotalMinor,
      currency
    }
  };
}

function mapPaymentAttempt(record: PaymentAttemptRecord): PaymentAttempt {
  return {
    id: record.id,
    sellerId: record.sellerId,
    orderId: record.orderId,
    provider: record.provider,
    providerReference: record.providerReference ?? undefined,
    idempotencyKey: record.idempotencyKey ?? undefined,
    status: record.status.toLowerCase() as PaymentAttempt["status"],
    amount: {
      amountMinor: record.amountMinor,
      currency: record.currency
    },
    metadata: (record.metadataJson as KeyValueRecord | null) ?? undefined,
    rawPayload: (record.rawPayloadJson as KeyValueRecord | null) ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapFulfillment(record: FulfillmentRecordRecord): FulfillmentRecord {
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
    rawPayload: (record.rawPayloadJson as KeyValueRecord | null) ?? undefined,
    lastWebhookAt: record.lastWebhookAt?.toISOString(),
    handedOffAt: record.handedOffAt?.toISOString(),
    deliveredAt: record.deliveredAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapNotification(record: NotificationRecord): OperatorNotificationSummary {
  return {
    id: record.id,
    sellerId: record.sellerId,
    orderId: record.orderId,
    orderNumber: record.order.orderNumber,
    channel: record.channel.toLowerCase() as OperatorNotificationSummary["channel"],
    status: record.status.toLowerCase() as OperatorNotificationSummary["status"],
    recipientRole: record.recipientRole.toLowerCase() as OperatorNotificationSummary["recipientRole"],
    recipientAddress: record.recipientAddress,
    templateKey: record.templateKey as OperatorNotificationSummary["templateKey"],
    eventType: record.eventType,
    eventIdempotencyKey: record.eventIdempotencyKey,
    notificationKey: record.notificationKey,
    subject: record.subject,
    body: record.body,
    providerMessageId: record.providerMessageId ?? undefined,
    providerPayload: (record.providerPayloadJson as KeyValueRecord | null) ?? undefined,
    failureMessage: record.failureMessage ?? undefined,
    dispatchedAt: record.dispatchedAt?.toISOString(),
    acknowledgedAt: record.acknowledgedAt?.toISOString(),
    acknowledgedBySellerId: record.acknowledgedBySellerId ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export class PrismaOperatorQueryRepository implements OperatorQueryRepository {
  async getOrderDetail(orderId: string): Promise<OperatorOrderDetail | null> {
    const record = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        lines: true
      }
    });

    if (!record) {
      return null;
    }

    const order = mapOrder(record as unknown as OrderRecord);

    return {
      order,
      customer: {
        id: record.customer.id,
        name: record.customer.name,
        phone: record.customer.phone,
        email: record.customer.email ?? undefined,
        city: record.customer.city ?? undefined,
        addressText: record.customer.addressText ?? undefined
      },
      lines: record.lines.map((line) =>
        mapOrderLine(line as unknown as OrderLineRecord, record.currency)
      )
    };
  }

  async listPaymentAttempts(orderId: string): Promise<PaymentAttempt[]> {
    const records = await prisma.paymentAttempt.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" }
    });

    return records.map((record) => mapPaymentAttempt(record as unknown as PaymentAttemptRecord));
  }

  async getFulfillment(orderId: string): Promise<FulfillmentRecord | null> {
    const record = await prisma.fulfillmentRecord.findUnique({
      where: { orderId }
    });

    if (!record) {
      return null;
    }

    return mapFulfillment(record as unknown as FulfillmentRecordRecord);
  }

  async listOrderTimeline(orderId: string): Promise<OperatorOrderTimelineEntry[]> {
    const records = await prisma.orderEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" }
    });

    return records.map((record) => ({
      id: record.id,
      eventType: record.eventType,
      payload: (record.payloadJson as KeyValueRecord | null) ?? undefined,
      createdAt: record.createdAt.toISOString()
    }));
  }

  async listShippingWebhookReceipts(orderId: string): Promise<OperatorShippingWebhookReceipt[]> {
    const records = await prisma.shippingWebhookReceipt.findMany({
      where: { orderId },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }]
    });

    return records.map((record) => ({
      id: record.id,
      provider: record.provider,
      eventType: record.eventType,
      idempotencyKey: record.idempotencyKey,
      providerReference: record.providerReference ?? undefined,
      trackingNumber: record.trackingNumber ?? undefined,
      normalizedStatus: record.normalizedStatus,
      rawPayload: record.rawPayloadJson as KeyValueRecord,
      receivedAt: record.receivedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    }));
  }

  async listNotificationsByOrder(orderId: string): Promise<OperatorNotificationSummary[]> {
    const client = prisma as any;
    const records = await client.notificationLog.findMany({
      where: { orderId },
      include: {
        order: {
          select: {
            orderNumber: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return records.map((record: NotificationRecord) => mapNotification(record));
  }
}
