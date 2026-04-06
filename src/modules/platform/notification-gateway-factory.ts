import type { AppConfig } from "../../core/config.js";
import { MemoryNotificationGateway } from "../../adapters/memory/memory-notification-gateway.js";
import { ResendNotificationGateway } from "../../adapters/resend/resend-notification-gateway.js";
import type { NotificationGateway } from "../../ports/notification-gateway.js";

export function createNotificationGateway(
  config: Pick<
    AppConfig,
    | "NOTIFICATION_PROVIDER"
    | "NOTIFICATION_FROM_EMAIL"
    | "NOTIFICATION_REPLY_TO_EMAIL"
    | "RESEND_API_KEY"
    | "RESEND_BASE_URL"
  >,
  options: {
    fetchFn?: typeof fetch;
  } = {}
): NotificationGateway {
  if (config.NOTIFICATION_PROVIDER === "memory") {
    return new MemoryNotificationGateway();
  }

  if (!config.RESEND_API_KEY || !config.NOTIFICATION_FROM_EMAIL) {
    throw new Error("Resend notification gateway requires API key and from email");
  }

  return new ResendNotificationGateway({
    apiKey: config.RESEND_API_KEY,
    fromEmail: config.NOTIFICATION_FROM_EMAIL,
    replyToEmail: config.NOTIFICATION_REPLY_TO_EMAIL,
    baseUrl: config.RESEND_BASE_URL,
    fetchFn: options.fetchFn
  });
}
