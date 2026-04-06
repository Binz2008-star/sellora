import { describe, expect, it, vi } from "vitest";
import { KarrioShippingGateway } from "../../src/adapters/karrio/karrio-shipping-gateway.js";

function createGateway(response: {
  ok: boolean;
  status?: number;
  payload: unknown;
}) {
  const fetchFn = vi.fn(async (_input: string, init?: RequestInit) => {
    return {
      ok: response.ok,
      status: response.status ?? 200,
      async json() {
        return response.payload;
      },
      init
    } as unknown as Response;
  });

  const gateway = new KarrioShippingGateway({
    baseUrl: "https://api.karrio.test",
    apiKey: "secret",
    providerName: "karrio",
    carrierId: "carrier_1",
    service: "express",
    shipperAddress: {
      postalCode: "00000",
      countryCode: "AE",
      city: "Dubai"
    },
    recipientDefaults: {
      postalCode: "11111",
      countryCode: "AE",
      city: "Abu Dhabi"
    },
    parcelTemplate: {
      weight: 1,
      weightUnit: "KG",
      distanceUnit: "CM"
    },
    fetchFn
  });

  return { gateway, fetchFn };
}

describe("KarrioShippingGateway", () => {
  it("maps successful provider response into normalized booking result", async () => {
    const { gateway, fetchFn } = createGateway({
      ok: true,
      payload: {
        data: {
          id: "shp_123",
          tracking_number: "TRK_123",
          tracking_url: "https://track.example/TRK_123",
          carrier_name: "karrio-carrier"
        }
      }
    });

    const result = await gateway.bookShipment({
      orderId: "order_1",
      destinationCity: "Sharjah",
      items: [
        {
          title: "Phone",
          quantity: 1
        }
      ]
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      Authorization: "Token secret",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(init.body as string)).toMatchObject({
      carrier_id: "carrier_1",
      service: "express",
      recipient: {
        city: "Sharjah",
        postal_code: "11111",
        country_code: "AE"
      },
      metadata: {
        order_id: "order_1"
      }
    });

    expect(result).toEqual({
      success: true,
      provider: "karrio",
      providerReference: "shp_123",
      bookingReference: "shp_123",
      trackingNumber: "TRK_123",
      trackingUrl: "https://track.example/TRK_123",
      courierName: "karrio-carrier",
      rawPayload: {
        id: "shp_123",
        tracking_number: "TRK_123",
        tracking_url: "https://track.example/TRK_123",
        carrier_name: "karrio-carrier"
      }
    });
  });

  it("normalizes provider failures without leaking provider payload shape", async () => {
    const { gateway } = createGateway({
      ok: false,
      status: 422,
      payload: {
        error: {
          code: "invalid_address",
          message: "Recipient address is invalid"
        }
      }
    });

    const result = await gateway.bookShipment({
      orderId: "order_1",
      items: []
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBe("karrio");
    expect(result.failureCode).toBe("invalid_address");
    expect(result.failureMessage).toBe("Recipient address is invalid");
    expect(result.rawPayload).toEqual({
      error: {
        code: "invalid_address",
        message: "Recipient address is invalid"
      }
    });
  });

  it("maps shipment status response into normalized status snapshot", async () => {
    const { gateway, fetchFn } = createGateway({
      ok: true,
      payload: {
        data: {
          id: "shp_123",
          tracking_number: "TRK_123",
          tracking_url: "https://track.example/TRK_123",
          carrier_name: "karrio-carrier",
          status: "delivered",
          updated_at: "2026-04-06T00:00:00.000Z"
        }
      }
    });

    const result = await gateway.getShipmentStatus({
      bookingReference: "shp_123",
      trackingNumber: "TRK_123"
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.karrio.test/v1/trackers/shp_123");
    expect(init.method).toBe("GET");
    expect(result).toEqual({
      success: true,
      provider: "karrio",
      providerReference: "shp_123",
      trackingNumber: "TRK_123",
      trackingUrl: "https://track.example/TRK_123",
      courierName: "karrio-carrier",
      normalizedStatus: "delivered",
      observedAt: "2026-04-06T00:00:00.000Z",
      rawPayload: {
        id: "shp_123",
        tracking_number: "TRK_123",
        tracking_url: "https://track.example/TRK_123",
        carrier_name: "karrio-carrier",
        status: "delivered",
        updated_at: "2026-04-06T00:00:00.000Z"
      }
    });
  });

  it("returns normalized failure when status lookup has no identifier", async () => {
    const { gateway, fetchFn } = createGateway({
      ok: true,
      payload: {}
    });

    const result = await gateway.getShipmentStatus({});

    expect(fetchFn).toHaveBeenCalledTimes(0);
    expect(result.success).toBe(false);
    expect(result.failureMessage).toBe(
      "Shipment status lookup requires booking reference or tracking number"
    );
  });
});
