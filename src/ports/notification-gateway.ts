import type { KeyValueRecord } from "../domain/shared/types.js";

export interface EmailNotificationRequest {
  recipientEmail: string;
  subject: string;
  body: string;
  metadata?: KeyValueRecord;
}

export interface EmailNotificationResult {
  providerMessageId?: string;
  providerPayload?: KeyValueRecord;
}

export interface NotificationGateway {
  sendEmail(request: EmailNotificationRequest): Promise<EmailNotificationResult>;
}
