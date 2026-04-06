import type { NotificationLog } from "../../domain/notifications/notification.js";
import type { NotificationRepository } from "../../ports/notification-repository.js";

export interface AcknowledgeNotificationInput {
  notificationId: string;
  sellerId: string;
}

export class AcknowledgeNotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async execute(input: AcknowledgeNotificationInput): Promise<NotificationLog> {
    const acknowledged = await this.notificationRepository.acknowledge(
      input.notificationId,
      input.sellerId
    );

    if (!acknowledged) {
      throw new Error(`Notification not found: ${input.notificationId}`);
    }

    return acknowledged;
  }
}
