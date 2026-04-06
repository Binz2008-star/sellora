import { Prisma } from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type { NotificationLog } from "../../domain/notifications/notification.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type {
  CreateNotificationLogInput,
  NotificationLogCreateResult,
  NotificationRepository,
  OrderNotificationContext
} from "../../ports/notification-repository.js";

type NotificationLogRecord = {
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
};

function mapNotificationLog(record: NotificationLogRecord): NotificationLog {
  return {
    id: record.id,
    sellerId: record.sellerId,
    orderId: record.orderId,
    channel: record.channel.toLowerCase() as NotificationLog["channel"],
    status: record.status.toLowerCase() as NotificationLog["status"],
    recipientRole: record.recipientRole.toLowerCase() as NotificationLog["recipientRole"],
    recipientAddress: record.recipientAddress,
    templateKey: record.templateKey as NotificationLog["templateKey"],
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

export class PrismaNotificationRepository implements NotificationRepository {
  async getOrderNotificationContext(orderId: string): Promise<OrderNotificationContext | null> {
    const record = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        seller: {
          include: {
            owner: true
          }
        },
        fulfillmentRecord: true
      }
    });

    if (!record) {
      return null;
    }

    return {
      sellerId: record.sellerId,
      orderId: record.id,
      orderNumber: record.orderNumber,
      sellerDisplayName: record.seller.displayName,
      operatorEmail: record.seller.owner.email,
      customerName: record.customer.name ?? undefined,
      customerEmail: record.customer.email ?? undefined,
      paymentStatus: record.paymentStatus.toLowerCase(),
      trackingNumber: record.fulfillmentRecord?.trackingNumber ?? undefined,
      trackingUrl: record.fulfillmentRecord?.trackingUrl ?? undefined,
      courierName: record.fulfillmentRecord?.courierName ?? undefined
    };
  }

  async createPendingLog(input: CreateNotificationLogInput): Promise<NotificationLogCreateResult> {
    const client = prisma as any;

    try {
      const record = await client.notificationLog.create({
        data: {
          sellerId: input.sellerId,
          orderId: input.orderId,
          channel: "EMAIL",
          status: "PENDING",
          recipientRole: input.recipientRole.toUpperCase() as "CUSTOMER" | "OPERATOR",
          recipientAddress: input.recipientAddress,
          templateKey: input.templateKey,
          eventType: input.eventType,
          eventIdempotencyKey: input.eventIdempotencyKey,
          notificationKey: input.notificationKey,
          subject: input.subject,
          body: input.body
        }
      });

      return {
        duplicate: false,
        log: mapNotificationLog(record as unknown as NotificationLogRecord)
      };
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "P2002")
      ) {
        const existing = await client.notificationLog.findUniqueOrThrow({
          where: { notificationKey: input.notificationKey }
        });

        return {
          duplicate: true,
          log: mapNotificationLog(existing as unknown as NotificationLogRecord)
        };
      }

      throw error;
    }
  }

  async markSent(
    notificationLogId: string,
    input: {
      providerMessageId?: string;
      providerPayload?: KeyValueRecord;
    }
  ): Promise<NotificationLog> {
    const client = prisma as any;
    const record = await client.notificationLog.update({
      where: { id: notificationLogId },
      data: {
        status: "SENT",
        providerMessageId: input.providerMessageId,
        providerPayloadJson: input.providerPayload as Prisma.InputJsonValue | undefined,
        failureMessage: null,
        dispatchedAt: new Date()
      }
    });

    return mapNotificationLog(record as unknown as NotificationLogRecord);
  }

  async markFailed(
    notificationLogId: string,
    input: {
      failureMessage: string;
      providerPayload?: KeyValueRecord;
    }
  ): Promise<NotificationLog> {
    const client = prisma as any;
    const record = await client.notificationLog.update({
      where: { id: notificationLogId },
      data: {
        status: "FAILED",
        failureMessage: input.failureMessage,
        providerPayloadJson: input.providerPayload as Prisma.InputJsonValue | undefined
      }
    });

    return mapNotificationLog(record as unknown as NotificationLogRecord);
  }

  async acknowledge(
    notificationLogId: string,
    acknowledgedBySellerId: string
  ): Promise<NotificationLog | null> {
    const client = prisma as any;
    const existing = await client.notificationLog.findUnique({
      where: { id: notificationLogId }
    });

    if (!existing) {
      return null;
    }

    if (existing.acknowledgedAt) {
      return mapNotificationLog(existing as NotificationLogRecord);
    }

    const record = await client.notificationLog.update({
      where: { id: notificationLogId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBySellerId
      }
    });

    return mapNotificationLog(record as NotificationLogRecord);
  }
}
