import type { KeyValueRecord } from "../domain/shared/types.js";

export interface EmailNotificationRequest {
  recipientEmail: string;
  subject: string;
  body: string;
  metadata?: KeyValueRecord;
  idempotencyKey?: string;
}

export interface EmailNotificationResult {
  providerMessageId?: string;
  providerPayload?: KeyValueRecord;
}

export class NotificationDispatchError extends Error {
  constructor(
    message: string,
    public readonly providerPayload?: KeyValueRecord
  ) {
    super(message);
    this.name = "NotificationDispatchError";
  }
}

export interface NotificationGateway {
  sendEmail(request: EmailNotificationRequest): Promise<EmailNotificationResult>;
}
