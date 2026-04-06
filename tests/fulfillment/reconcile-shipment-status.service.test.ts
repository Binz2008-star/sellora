import { describe, expect, it } from "vitest";
import type { Order, FulfillmentRecord } from "../../src/domain/orders/order.js";
import { ReconcileShipmentStatusService } from "../../src/application/fulfillment/reconcile-shipment-status.service.js";
import type {
  FulfillmentDeliveryContext,
  FulfillmentRepository
} from "../../src/ports/fulfillment-repository.js";
import type {
  ShipmentStatusRequest,
  ShipmentStatusResult,
  ShippingGateway
} from "../../src/ports/shipping-gateway.js";
import type { NormalizedShippingWebhook } from "../../src/adapters/karrio/karrio-webhook-ingress.js";

function makeOrder(status: Order["status"]): Order {
  return {
    id: "order_1",
    sellerId: "seller_1",
    customerId: "customer_1",
    orderNumber: "SOR-REC-1",
    mode: "standard",
    paymentPolicy: "full-upfront",
    status,
    paymentStatus: "paid",
    subtotal: { amountMinor: 10000, currency: "AED" },
    total: { amountMinor: 10000, currency: "AED" },
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z"
  };
}

function makeFulfillmentRecord(
  status: FulfillmentRecord["status"],
  providerStatus?: string
): FulfillmentRecord {
  return {
    id: "fulfillment_1",
    sellerId: "seller_1",
    orderId: "order_1",
    status,
    bookingReference: "ship_ref_1",
    trackingNumber: "TRK-1",
    courierName: "karrio",
    providerStatus,
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z"
  };
}

class FakeFulfillmentRepository implements FulfillmentRepository {
  constructor(private readonly context: FulfillmentDeliveryContext | null) {}

  async getShipmentContext() {
    throw new Error("not used");
  }

  async getDeliveryContext(orderId: string) {
    if (!this.context || this.context.order.id !== orderId) {
      return null;
    }

    return this.context;
  }

  async findWebhookContext() {
    throw new Error("not used");
  }

  async updateProviderStatus() {
    throw new Error("not used");
  }
}

class FakeShippingGateway implements ShippingGateway {
  statusCalls: ShipmentStatusRequest[] = [];

  constructor(
    private readonly statusResult: ShipmentStatusResult,
    private readonly thrownError?: Error
  ) {}

  async bookShipment() {
    throw new Error("not used");
  }

  async getShipmentStatus(request: ShipmentStatusRequest): Promise<ShipmentStatusResult> {
    this.statusCalls.push(request);
    if (this.thrownError) {
      throw this.thrownError;
    }
    return this.statusResult;
  }
}

class FakeHandleShippingWebhookService {
  calls: NormalizedShippingWebhook[] = [];
  duplicateKeys = new Set<string>();

  async execute(webhook: NormalizedShippingWebhook) {
    this.calls.push(webhook);
    if (this.duplicateKeys.has(webhook.idempotencyKey)) {
      return {
        duplicate: true,
        deliveredHandoff: false
      };
    }

    this.duplicateKeys.add(webhook.idempotencyKey);

    return {
      duplicate: false,
      deliveredHandoff: webhook.normalizedStatus === "delivered"
    };
  }
}

describe("ReconcileShipmentStatusService", () => {
  it("recovers a missed delivered status through the shipping status pipeline", async () => {
    const gateway = new FakeShippingGateway({
      success: true,
      provider: "karrio",
      providerReference: "ship_ref_1",
      trackingNumber: "TRK-1",
      normalizedStatus: "delivered",
      observedAt: "2026-04-06T00:00:00.000Z",
      rawPayload: {
        id: "ship_ref_1",
        tracking_number: "TRK-1",
        status: "delivered"
      }
    });
    const handleShippingWebhookService = new FakeHandleShippingWebhookService();
    const service = new ReconcileShipmentStatusService(
      new FakeFulfillmentRepository({
        order: makeOrder("shipped"),
        fulfillmentRecord: makeFulfillmentRecord("shipped")
      }),
      gateway,
      handleShippingWebhookService
    );

    const result = await service.execute({
      orderId: "order_1"
    });

    expect(result.duplicate).toBe(false);
    expect(result.deliveredHandoff).toBe(true);
    expect(result.noChange).toBe(false);
    expect(gateway.statusCalls).toEqual([
      {
        bookingReference: "ship_ref_1",
        trackingNumber: "TRK-1"
      }
    ]);
    expect(handleShippingWebhookService.calls).toHaveLength(1);
    expect(handleShippingWebhookService.calls[0].eventType).toBe("tracker.reconciled");
    expect(handleShippingWebhookService.calls[0].normalizedStatus).toBe("delivered");
  });

  it("treats repeated reconciliation snapshots as duplicate effects", async () => {
    const gateway = new FakeShippingGateway({
      success: true,
      provider: "karrio",
      providerReference: "ship_ref_1",
      trackingNumber: "TRK-1",
      normalizedStatus: "delivered",
      observedAt: "2026-04-06T00:00:00.000Z",
      rawPayload: {
        id: "ship_ref_1",
        tracking_number: "TRK-1",
        status: "delivered"
      }
    });
    const handleShippingWebhookService = new FakeHandleShippingWebhookService();
    const service = new ReconcileShipmentStatusService(
      new FakeFulfillmentRepository({
        order: makeOrder("shipped"),
        fulfillmentRecord: makeFulfillmentRecord("shipped")
      }),
      gateway,
      handleShippingWebhookService
    );

    await service.execute({ orderId: "order_1" });
    const second = await service.execute({ orderId: "order_1" });

    expect(second.duplicate).toBe(true);
    expect(second.deliveredHandoff).toBe(false);
    expect(second.noChange).toBe(true);
    expect(handleShippingWebhookService.calls).toHaveLength(2);
    expect(handleShippingWebhookService.calls[0].idempotencyKey).toBe(
      handleShippingWebhookService.calls[1].idempotencyKey
    );
  });

  it("falls back to fulfillment status when provider snapshot is unavailable", async () => {
    const gateway = new FakeShippingGateway({
      success: false,
      provider: "karrio",
      failureMessage: "Tracking not found"
    });
    const handleShippingWebhookService = new FakeHandleShippingWebhookService();
    const service = new ReconcileShipmentStatusService(
      new FakeFulfillmentRepository({
        order: makeOrder("shipped"),
        fulfillmentRecord: makeFulfillmentRecord("delivered", "delivered")
      }),
      gateway,
      handleShippingWebhookService
    );

    const result = await service.execute({
      orderId: "order_1"
    });

    expect(result.duplicate).toBe(false);
    expect(result.deliveredHandoff).toBe(true);
    expect(result.noChange).toBe(false);
    expect(gateway.statusCalls).toHaveLength(1);
    expect(handleShippingWebhookService.calls).toHaveLength(1);
    expect(handleShippingWebhookService.calls[0].eventType).toBe(
      "tracker.reconciled.fallback"
    );
    expect(handleShippingWebhookService.calls[0].normalizedStatus).toBe("delivered");
  });

  it("falls back to fulfillment status when provider lookup throws", async () => {
    const gateway = new FakeShippingGateway(
      {
        success: false,
        provider: "karrio",
        failureMessage: "Tracking not found"
      },
      new Error("provider timeout")
    );
    const handleShippingWebhookService = new FakeHandleShippingWebhookService();
    const service = new ReconcileShipmentStatusService(
      new FakeFulfillmentRepository({
        order: makeOrder("shipped"),
        fulfillmentRecord: makeFulfillmentRecord("delivered", "delivered")
      }),
      gateway,
      handleShippingWebhookService
    );

    const result = await service.execute({
      orderId: "order_1"
    });

    expect(result.duplicate).toBe(false);
    expect(result.deliveredHandoff).toBe(true);
    expect(result.noChange).toBe(false);
    expect(gateway.statusCalls).toHaveLength(1);
    expect(handleShippingWebhookService.calls).toHaveLength(1);
    expect(handleShippingWebhookService.calls[0].eventType).toBe(
      "tracker.reconciled.fallback"
    );
  });

  it("no-ops already-synced delivered shipments before querying provider again", async () => {
    const gateway = new FakeShippingGateway({
      success: true,
      provider: "karrio",
      providerReference: "ship_ref_1",
      trackingNumber: "TRK-1",
      normalizedStatus: "delivered",
      observedAt: "2026-04-06T00:00:00.000Z",
      rawPayload: {
        id: "ship_ref_1",
        tracking_number: "TRK-1",
        status: "delivered"
      }
    });
    const handleShippingWebhookService = new FakeHandleShippingWebhookService();
    const service = new ReconcileShipmentStatusService(
      new FakeFulfillmentRepository({
        order: makeOrder("delivered"),
        fulfillmentRecord: makeFulfillmentRecord("delivered", "delivered")
      }),
      gateway,
      handleShippingWebhookService
    );

    const result = await service.execute({
      orderId: "order_1"
    });

    expect(result.duplicate).toBe(true);
    expect(result.noChange).toBe(true);
    expect(gateway.statusCalls).toHaveLength(0);
    expect(handleShippingWebhookService.calls).toHaveLength(0);
  });
});
