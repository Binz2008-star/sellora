import type {
  EmailNotificationRequest,
  EmailNotificationResult,
  NotificationGateway
} from "../../ports/notification-gateway.js";

export class MemoryNotificationGateway implements NotificationGateway {
  readonly sentEmails: EmailNotificationRequest[] = [];
  shouldFail = false;

  async sendEmail(request: EmailNotificationRequest): Promise<EmailNotificationResult> {
    if (this.shouldFail) {
      throw new Error("notification gateway unavailable");
    }

    this.sentEmails.push(request);
    return {
      providerMessageId: `memory_email_${this.sentEmails.length}`,
      providerPayload: {
        recipientEmail: request.recipientEmail,
        subject: request.subject,
        idempotencyKey: request.idempotencyKey ?? null
      }
    };
  }
}
