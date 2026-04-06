import { describe, expect, it } from "vitest";
import { SendOrderNotificationService } from "../../src/application/notifications/send-order-notification.service.js";
import { MemoryNotificationGateway } from "../../src/adapters/memory/memory-notification-gateway.js";
import { NotificationFanoutEventBus } from "../../src/modules/events/notification-fanout-event-bus.js";
import { MemoryEventBus } from "../../src/adapters/memory/memory-event-bus.js";
import type { EventEnvelope } from "../../src/domain/events/event-envelope.js";
import type {
  CreateNotificationLogInput,
  NotificationLogCreateResult,
  NotificationRepository,
  OrderNotificationContext
} from "../../src/ports/notification-repository.js";
import type { NotificationLog } from "../../src/domain/notifications/notification.js";
import type { KeyValueRecord } from "../../src/domain/shared/types.js";

function makeLog(
  overrides: Partial<NotificationLog> = {}
): NotificationLog {
  return {
    id: "notification_1",
    sellerId: "seller_1",
    orderId: "order_1",
    channel: "email",
    status: "pending",
    recipientRole: "customer",
    recipientAddress: "customer@sellora.test",
    templateKey: "payment_succeeded",
    eventType: "payment_succeeded",
    eventIdempotencyKey: "event_1",
    notificationKey: "notify_1",
    subject: "subject",
    body: "body",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides
  };
}

class FakeNotificationRepository implements NotificationRepository {
  context: OrderNotificationContext = {
    sellerId: "seller_1",
    orderId: "order_1",
    orderNumber: "SOR-1",
    sellerDisplayName: "Sellora",
    operatorEmail: "owner@sellora.test",
    customerName: "Loyal",
    customerEmail: "customer@sellora.test",
    paymentStatus: "paid",
    trackingNumber: "TRK-1",
    trackingUrl: "https://track.test/TRK-1",
    courierName: "karrio"
  };

  logs: NotificationLog[] = [];

  async getOrderNotificationContext(orderId: string): Promise<OrderNotificationContext | null> {
    return this.context.orderId === orderId ? this.context : null;
  }

  async createPendingLog(input: CreateNotificationLogInput): Promise<NotificationLogCreateResult> {
    const duplicate = this.logs.find((log) => log.notificationKey === input.notificationKey);
    if (duplicate) {
      return {
        duplicate: true,
        log: duplicate
      };
    }

    const log = makeLog({
      id: `notification_${this.logs.length + 1}`,
      sellerId: input.sellerId,
      orderId: input.orderId,
      recipientRole: input.recipientRole,
      recipientAddress: input.recipientAddress,
      templateKey: input.templateKey,
      eventType: input.eventType,
      eventIdempotencyKey: input.eventIdempotencyKey,
      notificationKey: input.notificationKey,
      subject: input.subject,
      body: input.body
    });
    this.logs.push(log);

    return {
      duplicate: false,
      log
    };
  }

  async markSent(
    notificationLogId: string,
    input: { providerMessageId?: string; providerPayload?: KeyValueRecord }
  ): Promise<NotificationLog> {
    const index = this.logs.findIndex((log) => log.id === notificationLogId);
    this.logs[index] = {
      ...this.logs[index],
      status: "sent",
      providerMessageId: input.providerMessageId,
      providerPayload: input.providerPayload,
      dispatchedAt: "2026-04-06T00:00:00.000Z"
    };

    return this.logs[index];
  }

  async markFailed(
    notificationLogId: string,
    input: { failureMessage: string; providerPayload?: KeyValueRecord }
  ): Promise<NotificationLog> {
    const index = this.logs.findIndex((log) => log.id === notificationLogId);
    this.logs[index] = {
      ...this.logs[index],
      status: "failed",
      failureMessage: input.failureMessage,
      providerPayload: input.providerPayload
    };

    return this.logs[index];
  }
}

function makeEvent(eventType: string, aggregateId: string, payload: Record<string, unknown>): EventEnvelope {
  return {
    id: `${eventType}_${aggregateId}`,
    aggregateType: "order",
    aggregateId,
    eventType,
    occurredAt: "2026-04-06T00:00:00.000Z",
    idempotencyKey: `${eventType}_${aggregateId}_idem`,
    payload
  };
}

describe("SendOrderNotificationService", () => {
  it("creates email notifications for payment success, shipment booked, and order delivered", async () => {
    const repository = new FakeNotificationRepository();
    const gateway = new MemoryNotificationGateway();
    const service = new SendOrderNotificationService(repository, gateway);

    const results = await Promise.all([
      service.handleEvent(
        makeEvent("payment_succeeded", "payment_1", {
          orderId: "order_1"
        })
      ),
      service.handleEvent(
        makeEvent("order_status_changed", "order_1", {
          from: "packing",
          to: "shipped",
          reason: "shipment_booked"
        })
      ),
      service.handleEvent(
        makeEvent("order_status_changed", "order_1", {
          from: "shipped",
          to: "delivered",
          reason: "delivery_confirmed"
        })
      )
    ]);

    expect(results.every((result) => result.handled && !result.failed)).toBe(true);
    expect(repository.logs.map((log) => log.templateKey)).toEqual([
      "payment_succeeded",
      "shipment_booked",
      "order_delivered"
    ]);
    expect(gateway.sentEmails).toHaveLength(3);
    expect(gateway.sentEmails.every((email) => typeof email.idempotencyKey === "string")).toBe(true);
  });

  it("prevents duplicate notifications for repeated facts", async () => {
    const repository = new FakeNotificationRepository();
    const gateway = new MemoryNotificationGateway();
    const service = new SendOrderNotificationService(repository, gateway);
    const fanoutEventBus = new NotificationFanoutEventBus(new MemoryEventBus(), service);
    const event = makeEvent("payment_succeeded", "payment_1", {
      orderId: "order_1"
    });

    await fanoutEventBus.publish(event);
    await fanoutEventBus.publish(event);

    expect(repository.logs).toHaveLength(1);
    expect(gateway.sentEmails).toHaveLength(1);
  });

  it("isolates failed dispatch from event publication and records the failed log", async () => {
    const repository = new FakeNotificationRepository();
    const gateway = new MemoryNotificationGateway();
    gateway.shouldFail = true;
    const innerBus = new MemoryEventBus();
    const service = new SendOrderNotificationService(repository, gateway);
    const fanoutEventBus = new NotificationFanoutEventBus(innerBus, service);

    await expect(
      fanoutEventBus.publish(
        makeEvent("payment_succeeded", "payment_1", {
          orderId: "order_1"
        })
      )
    ).resolves.toBeUndefined();

    expect(innerBus.events).toHaveLength(1);
    expect(repository.logs).toHaveLength(1);
    expect(repository.logs[0].status).toBe("failed");
    expect(repository.logs[0].providerPayload).toEqual(undefined);
  });
});
