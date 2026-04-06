import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeKarrioWebhook } from "../../src/adapters/karrio/karrio-webhook-ingress.js";

function sign(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

describe("normalizeKarrioWebhook", () => {
  it("normalizes payload into internal webhook shape", () => {
    const rawBody = JSON.stringify({
      type: "tracker.updated",
      created_at: "2026-04-06T00:00:00.000Z",
      data: {
        id: "ship_ref_1",
        tracking_number: "TRK-1",
        status: "DELIVERED"
      }
    });

    const result = normalizeKarrioWebhook({
      headers: {},
      rawBody
    });

    expect(result.provider).toBe("karrio");
    expect(result.eventType).toBe("tracker.updated");
    expect(result.providerReference).toBe("ship_ref_1");
    expect(result.trackingNumber).toBe("TRK-1");
    expect(result.normalizedStatus).toBe("delivered");
    expect(result.rawPayload).toEqual(JSON.parse(rawBody));
  });

  it("rejects invalid signatures when secret is configured", () => {
    const rawBody = JSON.stringify({
      type: "tracker.updated",
      data: {
        id: "ship_ref_1",
        status: "delivered"
      }
    });

    expect(() =>
      normalizeKarrioWebhook({
        headers: {
          "x-karrio-signature": "bad-signature"
        },
        rawBody,
        secret: "secret"
      })
    ).toThrow("Invalid Karrio webhook signature");
  });

  it("accepts valid signatures when secret is configured", () => {
    const rawBody = JSON.stringify({
      type: "tracker.updated",
      data: {
        id: "ship_ref_1",
        status: "delivered"
      }
    });

    const result = normalizeKarrioWebhook({
      headers: {
        "x-karrio-signature": `sha256=${sign(rawBody, "secret")}`
      },
      rawBody,
      secret: "secret"
    });

    expect(result.providerReference).toBe("ship_ref_1");
  });
});
