import { describe, expect, it, vi } from "vitest";
import { ResendNotificationGateway } from "../../src/adapters/resend/resend-notification-gateway.js";

describe("ResendNotificationGateway", () => {
  it("sends text email requests through the Resend API with idempotency protection", async () => {
    const fetchFn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.resend.com/emails");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer resend_key",
        "Content-Type": "application/json",
        "Idempotency-Key": "notify_1"
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        from: "orders@sellora.test",
        to: ["customer@sellora.test"],
        subject: "Payment received",
        text: "Your payment was received.",
        reply_to: "support@sellora.test"
      });

      return new Response(JSON.stringify({ id: "email_1" }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    });

    const gateway = new ResendNotificationGateway({
      apiKey: "resend_key",
      fromEmail: "orders@sellora.test",
      replyToEmail: "support@sellora.test",
      fetchFn
    });

    await expect(
      gateway.sendEmail({
        recipientEmail: "customer@sellora.test",
        subject: "Payment received",
        body: "Your payment was received.",
        idempotencyKey: "notify_1",
        metadata: {
          orderId: "order_1"
        }
      })
    ).resolves.toEqual({
      providerMessageId: "email_1",
      providerPayload: {
        status: 200,
        id: "email_1"
      }
    });
  });

  it("surfaces provider failures as notification dispatch errors", async () => {
    const gateway = new ResendNotificationGateway({
      apiKey: "resend_key",
      fromEmail: "orders@sellora.test",
      fetchFn: vi.fn(async () => {
        return new Response(JSON.stringify({ message: "Invalid recipient" }), {
          status: 422,
          headers: {
            "content-type": "application/json"
          }
        });
      })
    });

    await expect(
      gateway.sendEmail({
        recipientEmail: "invalid",
        subject: "Payment received",
        body: "Your payment was received."
      })
    ).rejects.toMatchObject({
      name: "NotificationDispatchError",
      message: "Invalid recipient",
      providerPayload: {
        status: 422,
        message: "Invalid recipient"
      }
    });
  });

  it("rejects malformed successful responses that do not contain a provider message id", async () => {
    const gateway = new ResendNotificationGateway({
      apiKey: "resend_key",
      fromEmail: "orders@sellora.test",
      fetchFn: vi.fn(async () => {
        return new Response(JSON.stringify({ message: "ok" }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      })
    });

    await expect(
      gateway.sendEmail({
        recipientEmail: "customer@sellora.test",
        subject: "Shipment booked",
        body: "Your shipment is booked."
      })
    ).rejects.toMatchObject({
      name: "NotificationDispatchError",
      message: "Resend response missing email identifier",
      providerPayload: {
        status: 200,
        message: "ok"
      }
    });
  });
});
