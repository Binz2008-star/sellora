import type { EventEnvelope } from "../../domain/events/event-envelope.js";
import type { EventBus } from "../../ports/event-bus.js";
import type { SendOrderNotificationService } from "../../application/notifications/send-order-notification.service.js";

export class NotificationFanoutEventBus implements EventBus {
  constructor(
    private readonly innerEventBus: EventBus,
    private readonly sendOrderNotificationService: Pick<SendOrderNotificationService, "handleEvent">
  ) {}

  async publish(event: EventEnvelope): Promise<void> {
    await this.innerEventBus.publish(event);

    try {
      await this.sendOrderNotificationService.handleEvent(event);
    } catch {
      // Notification fanout must not corrupt authority writes or external event publication.
    }
  }
}
