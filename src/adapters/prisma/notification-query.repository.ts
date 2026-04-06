import { prisma } from "../../core/db/prisma.js";
import type { NotificationLog } from "../../domain/notifications/notification.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type {
  NotificationListFilters,
  NotificationQueryRepository,
  OperatorNotificationSummary
} from "../../ports/notification-query-repository.js";

type NotificationQueryRecord = {
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

function mapNotification(record: NotificationQueryRecord): OperatorNotificationSummary {
  return {
    id: record.id,
    sellerId: record.sellerId,
    orderId: record.orderId,
    orderNumber: record.order.orderNumber,
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

export class PrismaNotificationQueryRepository implements NotificationQueryRepository {
  async listNotifications(filters: NotificationListFilters): Promise<OperatorNotificationSummary[]> {
    const client = prisma as any;
    const records = await client.notificationLog.findMany({
      where: {
        sellerId: filters.sellerId,
        ...(filters.status ? { status: filters.status.toUpperCase() } : {}),
        ...(filters.acknowledged === undefined
          ? {}
          : filters.acknowledged
            ? { acknowledgedAt: { not: null } }
            : { acknowledgedAt: null })
      },
      include: {
        order: {
          select: {
            orderNumber: true
          }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return records.map((record: NotificationQueryRecord) => mapNotification(record));
  }

  async getNotificationDetail(notificationId: string): Promise<OperatorNotificationSummary | null> {
    const client = prisma as any;
    const record = await client.notificationLog.findUnique({
      where: { id: notificationId },
      include: {
        order: {
          select: {
            orderNumber: true
          }
        }
      }
    });

    if (!record) {
      return null;
    }

    return mapNotification(record as NotificationQueryRecord);
  }
}
