import type { EventEnvelope } from "../../domain/events/event-envelope.js";
import type {
  NotificationRecipientRole,
  NotificationTemplateKey
} from "../../domain/notifications/notification.js";
import { createIdempotencyKey } from "../../modules/events/idempotency.js";
import type { NotificationGateway } from "../../ports/notification-gateway.js";
import type {
  NotificationRepository,
  OrderNotificationContext
} from "../../ports/notification-repository.js";

export interface SendOrderNotificationResult {
  handled: boolean;
  duplicate: boolean;
  failed: boolean;
}

type NotificationTemplateSpec = {
  templateKey: NotificationTemplateKey;
  orderId: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function mapEventToTemplate(event: EventEnvelope): NotificationTemplateSpec | null {
  if (event.eventType === "payment_succeeded") {
    const orderId = asString(event.payload.orderId);
    if (!orderId) {
      return null;
    }

    return {
      templateKey: "payment_succeeded",
      orderId
    };
  }

  if (event.eventType !== "order_status_changed") {
    return null;
  }

  const nextStatus = asString(event.payload.to);
  const reason = asString(event.payload.reason);

  if (nextStatus === "shipped" && reason === "shipment_booked") {
    return {
      templateKey: "shipment_booked",
      orderId: event.aggregateId
    };
  }

  if (nextStatus === "delivered") {
    return {
      templateKey: "order_delivered",
      orderId: event.aggregateId
    };
  }

  return null;
}

function resolveRecipient(
  context: OrderNotificationContext
): { recipientRole: NotificationRecipientRole; recipientAddress: string } {
  if (context.customerEmail) {
    return {
      recipientRole: "customer",
      recipientAddress: context.customerEmail
    };
  }

  return {
    recipientRole: "operator",
    recipientAddress: context.operatorEmail
  };
}

function buildMessage(
  templateKey: NotificationTemplateKey,
  context: OrderNotificationContext
): { subject: string; body: string } {
  const recipientName = context.customerName ?? "there";

  switch (templateKey) {
    case "payment_succeeded":
      return {
        subject: `Payment received for order ${context.orderNumber}`,
        body: `Hello ${recipientName}, we received your payment for order ${context.orderNumber} from ${context.sellerDisplayName}.`
      };
    case "shipment_booked":
      return {
        subject: `Shipment booked for order ${context.orderNumber}`,
        body: `Hello ${recipientName}, your order ${context.orderNumber} has been booked for shipment.${context.trackingNumber ? ` Tracking number: ${context.trackingNumber}.` : ""}${context.trackingUrl ? ` Track here: ${context.trackingUrl}` : ""}`
      };
    case "order_delivered":
      return {
        subject: `Order ${context.orderNumber} delivered`,
        body: `Hello ${recipientName}, your order ${context.orderNumber} has been marked as delivered by ${context.sellerDisplayName}.`
      };
  }
}

export class SendOrderNotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationGateway: NotificationGateway
  ) {}

  async handleEvent(event: EventEnvelope): Promise<SendOrderNotificationResult> {
    const spec = mapEventToTemplate(event);
    if (!spec) {
      return {
        handled: false,
        duplicate: false,
        failed: false
      };
    }

    const context = await this.notificationRepository.getOrderNotificationContext(spec.orderId);
    if (!context) {
      return {
        handled: false,
        duplicate: false,
        failed: false
      };
    }

    const recipient = resolveRecipient(context);
    const message = buildMessage(spec.templateKey, context);
    const notificationKey = createIdempotencyKey([
      "notification",
      spec.templateKey,
      event.idempotencyKey,
      recipient.recipientAddress
    ]);

    const created = await this.notificationRepository.createPendingLog({
      sellerId: context.sellerId,
      orderId: context.orderId,
      recipientRole: recipient.recipientRole,
      recipientAddress: recipient.recipientAddress,
      templateKey: spec.templateKey,
      eventType: event.eventType,
      eventIdempotencyKey: event.idempotencyKey,
      notificationKey,
      subject: message.subject,
      body: message.body
    });

    if (created.duplicate) {
      return {
        handled: true,
        duplicate: true,
        failed: false
      };
    }

    try {
      const dispatched = await this.notificationGateway.sendEmail({
        recipientEmail: recipient.recipientAddress,
        subject: message.subject,
        body: message.body,
        metadata: {
          sellerId: context.sellerId,
          orderId: context.orderId,
          templateKey: spec.templateKey,
          eventType: event.eventType
        }
      });

      await this.notificationRepository.markSent(created.log.id, dispatched);

      return {
        handled: true,
        duplicate: false,
        failed: false
      };
    } catch (error) {
      await this.notificationRepository.markFailed(created.log.id, {
        failureMessage: error instanceof Error ? error.message : "notification_dispatch_failed"
      });

      return {
        handled: true,
        duplicate: false,
        failed: true
      };
    }
  }
}
