import type {
  NotificationLog,
  NotificationRecipientRole,
  NotificationTemplateKey
} from "../domain/notifications/notification.js";
import type { KeyValueRecord } from "../domain/shared/types.js";

export interface OrderNotificationContext {
  sellerId: string;
  orderId: string;
  orderNumber: string;
  sellerDisplayName: string;
  operatorEmail: string;
  customerName?: string;
  customerEmail?: string;
  paymentStatus: string;
  trackingNumber?: string;
  trackingUrl?: string;
  courierName?: string;
}

export interface CreateNotificationLogInput {
  sellerId: string;
  orderId: string;
  recipientRole: NotificationRecipientRole;
  recipientAddress: string;
  templateKey: NotificationTemplateKey;
  eventType: string;
  eventIdempotencyKey: string;
  notificationKey: string;
  subject: string;
  body: string;
}

export interface NotificationLogCreateResult {
  duplicate: boolean;
  log: NotificationLog;
}

export interface NotificationRepository {
  getOrderNotificationContext(orderId: string): Promise<OrderNotificationContext | null>;
  createPendingLog(input: CreateNotificationLogInput): Promise<NotificationLogCreateResult>;
  markSent(
    notificationLogId: string,
    input: {
      providerMessageId?: string;
      providerPayload?: KeyValueRecord;
    }
  ): Promise<NotificationLog>;
  markFailed(
    notificationLogId: string,
    input: {
      failureMessage: string;
      providerPayload?: KeyValueRecord;
    }
  ): Promise<NotificationLog>;
}
