import { describe, expect, it } from "vitest";
import type { FulfillmentRecord, Order } from "../../src/domain/orders/order.js";
import { ConfirmOrderDeliveryService } from "../../src/application/orders/confirm-order-delivery.service.js";
import type {
  FulfillmentDeliveryContext,
  FulfillmentRepository
} from "../../src/ports/fulfillment-repository.js";

function makeOrder(status: Order["status"]): Order {
  return {
    id: "order_1",
    sellerId: "seller_1",
    customerId: "customer_1",
    orderNumber: "SOR-DEL-1",
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

function makeFulfillmentRecord(status: FulfillmentRecord["status"]): FulfillmentRecord {
  return {
    id: "fulfillment_1",
    sellerId: "seller_1",
    orderId: "order_1",
    status,
    courierName: "Quiqup",
    trackingNumber: "TRK-1",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z"
  };
}

class FakeFulfillmentRepository implements FulfillmentRepository {
  constructor(private readonly context: FulfillmentDeliveryContext | null) {}

  async getShipmentContext() {
    throw new Error("not used");
  }

  async getDeliveryContext(orderId: string): Promise<FulfillmentDeliveryContext | null> {
    if (!this.context || this.context.order.id !== orderId) {
      return null;
    }

    return this.context;
  }
}

class FakeTransitionOrderService {
  calls: Array<{ orderId: string; nextStatus: Order["status"]; reason?: string }> = [];

  async transition(input: { orderId: string; nextStatus: Order["status"]; reason?: string }) {
    this.calls.push(input);

    return {
      order: {
        ...makeOrder("delivered"),
        id: input.orderId
      },
      fulfillmentRecord: {
        ...makeFulfillmentRecord("delivered"),
        orderId: input.orderId
      },
      inventoryMovements: [],
      pendingExternalEvents: []
    };
  }
}

function createHarness(status: Order["status"], fulfillmentStatus: FulfillmentRecord["status"] = "shipped") {
  const repository = new FakeFulfillmentRepository({
    order: makeOrder(status),
    fulfillmentRecord: makeFulfillmentRecord(fulfillmentStatus)
  });
  const transitionOrderService = new FakeTransitionOrderService();
  const service = new ConfirmOrderDeliveryService(repository, transitionOrderService);

  return { repository, transitionOrderService, service };
}

describe("ConfirmOrderDeliveryService", () => {
  it("confirms delivery for shipped orders via lifecycle authority", async () => {
    const { service, transitionOrderService } = createHarness("shipped");

    const result = await service.execute({
      orderId: "order_1"
    });

    expect(result.duplicateConfirmation).toBe(false);
    expect(transitionOrderService.calls).toHaveLength(1);
    expect(transitionOrderService.calls[0]).toEqual({
      orderId: "order_1",
      nextStatus: "delivered",
      reason: "delivery_confirmed"
    });
    expect(result.transition?.order.status).toBe("delivered");
    expect(result.transition?.inventoryMovements).toHaveLength(0);
    expect(result.transition?.fulfillmentRecord?.status).toBe("delivered");
  });

  it("rejects confirmation for non-shipped orders", async () => {
    const { service, transitionOrderService } = createHarness("packing");

    await expect(
      service.execute({
        orderId: "order_1"
      })
    ).rejects.toThrow("is not eligible for delivery confirmation");

    expect(transitionOrderService.calls).toHaveLength(0);
  });

  it("treats repeated confirmation on delivered order as idempotent", async () => {
    const { service, transitionOrderService } = createHarness("delivered", "delivered");

    const result = await service.execute({
      orderId: "order_1"
    });

    expect(result.duplicateConfirmation).toBe(true);
    expect(result.transition).toBeUndefined();
    expect(transitionOrderService.calls).toHaveLength(0);
  });
});
