import type { AuditStamp, EntityId, KeyValueRecord } from "../shared/types.js";

export type NotificationChannel = "email";
export type NotificationStatus = "pending" | "sent" | "failed";
export type NotificationRecipientRole = "customer" | "operator";
export type NotificationTemplateKey =
  | "payment_succeeded"
  | "shipment_booked"
  | "order_delivered";

export interface NotificationLog extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  orderId: EntityId;
  channel: NotificationChannel;
  status: NotificationStatus;
  recipientRole: NotificationRecipientRole;
  recipientAddress: string;
  templateKey: NotificationTemplateKey;
  eventType: string;
  eventIdempotencyKey: string;
  notificationKey: string;
  subject: string;
  body: string;
  providerMessageId?: string;
  providerPayload?: KeyValueRecord;
  failureMessage?: string;
  dispatchedAt?: string;
  acknowledgedAt?: string;
  acknowledgedBySellerId?: string;
}
