import { describe, expect, it } from "vitest";
import { AcknowledgeNotificationService } from "../../src/application/notifications/acknowledge-notification.service.js";
import type { NotificationLog } from "../../src/domain/notifications/notification.js";
import type { NotificationRepository } from "../../src/ports/notification-repository.js";

function makeNotification(overrides: Partial<NotificationLog> = {}): NotificationLog {
  return {
    id: "notification_1",
    sellerId: "seller_1",
    orderId: "order_1",
    channel: "email",
    status: "sent",
    recipientRole: "customer",
    recipientAddress: "customer@sellora.test",
    templateKey: "payment_succeeded",
    eventType: "payment_succeeded",
    eventIdempotencyKey: "event_1",
    notificationKey: "notify_1",
    subject: "Payment received",
    body: "Hello",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides
  };
}

class FakeNotificationRepository implements NotificationRepository {
  notification: NotificationLog | null = makeNotification();

  async getOrderNotificationContext() {
    throw new Error("not used");
  }

  async createPendingLog() {
    throw new Error("not used");
  }

  async markSent() {
    throw new Error("not used");
  }

  async markFailed() {
    throw new Error("not used");
  }

  async acknowledge(
    notificationLogId: string,
    acknowledgedBySellerId: string
  ): Promise<NotificationLog | null> {
    if (!this.notification || this.notification.id !== notificationLogId) {
      return null;
    }

    if (!this.notification.acknowledgedAt) {
      this.notification = makeNotification({
        ...this.notification,
        acknowledgedAt: "2026-04-06T01:00:00.000Z",
        acknowledgedBySellerId
      });
    }

    return this.notification;
  }
}

describe("AcknowledgeNotificationService", () => {
  it("acknowledges an unread notification", async () => {
    const repository = new FakeNotificationRepository();
    const service = new AcknowledgeNotificationService(repository);

    const result = await service.execute({
      notificationId: "notification_1",
      sellerId: "seller_1"
    });

    expect(result.acknowledgedAt).toBe("2026-04-06T01:00:00.000Z");
    expect(result.acknowledgedBySellerId).toBe("seller_1");
  });

  it("is idempotent for already acknowledged notifications", async () => {
    const repository = new FakeNotificationRepository();
    repository.notification = makeNotification({
      acknowledgedAt: "2026-04-06T01:00:00.000Z",
      acknowledgedBySellerId: "seller_1"
    });
    const service = new AcknowledgeNotificationService(repository);

    const result = await service.execute({
      notificationId: "notification_1",
      sellerId: "seller_1"
    });

    expect(result.acknowledgedAt).toBe("2026-04-06T01:00:00.000Z");
    expect(result.acknowledgedBySellerId).toBe("seller_1");
  });
});
