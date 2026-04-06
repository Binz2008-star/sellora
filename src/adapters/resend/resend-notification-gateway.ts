import type { KeyValueRecord } from "../../domain/shared/types.js";
import {
  NotificationDispatchError,
  type EmailNotificationRequest,
  type EmailNotificationResult,
  type NotificationGateway
} from "../../ports/notification-gateway.js";

export interface ResendNotificationGatewayOptions {
  apiKey: string;
  fromEmail: string;
  replyToEmail?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

type ResendSendEmailResponse = {
  id?: string;
  message?: string;
  name?: string;
};

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function extractProviderPayload(payload: unknown, status: number): KeyValueRecord {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      status,
      ...payload
    } as KeyValueRecord;
  }

  return {
    status,
    value: payload === undefined ? null : JSON.stringify(payload)
  };
}

function buildFailureMessage(payload: unknown, status: number): string {
  const response = payload as ResendSendEmailResponse | undefined;
  return response?.message ?? response?.name ?? `Resend email request failed with ${status}`;
}

export class ResendNotificationGateway implements NotificationGateway {
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: ResendNotificationGatewayOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.baseUrl = trimTrailingSlash(options.baseUrl ?? "https://api.resend.com");
  }

  async sendEmail(request: EmailNotificationRequest): Promise<EmailNotificationResult> {
    const response = await this.fetchFn(`${this.baseUrl}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
        ...(request.idempotencyKey
          ? {
              "Idempotency-Key": request.idempotencyKey
            }
          : {})
      },
      body: JSON.stringify({
        from: this.options.fromEmail,
        to: [request.recipientEmail],
        subject: request.subject,
        text: request.body,
        ...(this.options.replyToEmail
          ? {
              reply_to: this.options.replyToEmail
            }
          : {})
      })
    });

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      payload = {
        message: "Resend response was not valid JSON"
      };
    }

    const providerPayload = extractProviderPayload(payload, response.status);

    if (!response.ok) {
      throw new NotificationDispatchError(
        buildFailureMessage(payload, response.status),
        providerPayload
      );
    }

    const parsed = payload as ResendSendEmailResponse;
    if (!parsed.id) {
      throw new NotificationDispatchError(
        "Resend response missing email identifier",
        providerPayload
      );
    }

    return {
      providerMessageId: parsed.id,
      providerPayload
    };
  }
}
