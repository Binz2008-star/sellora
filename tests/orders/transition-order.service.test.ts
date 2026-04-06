import { beforeEach, describe, expect, it } from "vitest";
import { MemoryEventBus } from "../../src/adapters/memory/memory-event-bus.js";
import { TransitionOrderService } from "../../src/application/orders/transition-order.service.js";
import type { InventoryMovement, InventoryMode } from "../../src/domain/catalog/product.js";
import type { FulfillmentRecord, Order, OrderLine, OrderStatus } from "../../src/domain/orders/order.js";
import type {
  ApplyOrderTransitionInput,
  ApplyOrderTransitionResult,
  OrderLifecycleRepository,
  OrderTransitionContext,
  TransitionContextLine
} from "../../src/ports/order-lifecycle-repository.js";

function makeOrder(status: OrderStatus): Order {
  return {
    id: "order_1",
    sellerId: "seller_1",
    customerId: "customer_1",
    orderNumber: "SOR-TEST-1",
    mode: "standard",
    paymentPolicy: "full-upfront",
    status,
    paymentStatus: "pending",
    subtotal: { amountMinor: 10000, currency: "AED" },
    total: { amountMinor: 10000, currency: "AED" },
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z"
  };
}

function makeLine(inventoryMode: InventoryMode = "stocked"): TransitionContextLine {
  return {
    id: "line_1",
    orderId: "order_1",
    productId: "product_1",
    productOfferingId: "offering_1",
    titleSnapshot: "Test Product",
    quantity: 1,
    unitPrice: { amountMinor: 10000, currency: "AED" },
    costPrice: { amountMinor: 7000, currency: "AED" },
    currencySnapshot: "AED",
    selectedAttributesSnapshot: {},
    lineTotal: { amountMinor: 10000, currency: "AED" },
    inventoryMode
  };
}

class FakeOrderLifecycleRepository implements OrderLifecycleRepository {
  context: OrderTransitionContext;
  applyCalls: ApplyOrderTransitionInput[] = [];

  constructor(context: OrderTransitionContext) {
    this.context = context;
  }

  async getTransitionContext(orderId: string): Promise<OrderTransitionContext | null> {
    return this.context.order.id === orderId ? this.context : null;
  }

  async applyTransition(input: ApplyOrderTransitionInput): Promise<ApplyOrderTransitionResult> {
    this.applyCalls.push(input);

    const now = new Date().toISOString();
    const order: Order = {
      ...this.context.order,
      status: input.nextStatus,
      updatedAt: now
    };

    const inventoryMovements: InventoryMovement[] = input.inventoryActions.flatMap((action, index) => {
      if (action.type === "release") {
        return [
          {
            id: `movement_release_${index}`,
            sellerId: order.sellerId,
            productOfferingId: action.productOfferingId,
            type: "release",
            quantity: action.quantity,
            referenceType: "order",
            referenceId: order.id,
            notes: "release",
            occurredAt: now,
            createdAt: now,
            updatedAt: now
          }
        ];
      }

      return [
        {
          id: `movement_release_${index}`,
          sellerId: order.sellerId,
          productOfferingId: action.productOfferingId,
          type: "release",
          quantity: action.quantity,
          referenceType: "order",
          referenceId: order.id,
          notes: "release",
          occurredAt: now,
          createdAt: now,
          updatedAt: now
        },
        {
          id: `movement_deduct_${index}`,
          sellerId: order.sellerId,
          productOfferingId: action.productOfferingId,
          type: "deduct",
          quantity: action.quantity,
          referenceType: "order",
          referenceId: order.id,
          notes: "deduct",
          occurredAt: now,
          createdAt: now,
          updatedAt: now
        }
      ];
    });

    const fulfillmentRecord: FulfillmentRecord | undefined = input.fulfillmentUpdate
      ? {
          id: this.context.fulfillmentRecord?.id ?? "fulfillment_1",
          sellerId: order.sellerId,
          orderId: order.id,
          status: input.fulfillmentUpdate.status,
          bookingReference: input.fulfillmentUpdate.bookingReference,
          courierName: input.fulfillmentUpdate.courierName,
          trackingNumber: input.fulfillmentUpdate.trackingNumber,
          handedOffAt: input.fulfillmentUpdate.handedOffAt,
          deliveredAt: input.fulfillmentUpdate.deliveredAt,
          createdAt: this.context.fulfillmentRecord?.createdAt ?? now,
          updatedAt: now
        }
      : undefined;

    this.context = {
      ...this.context,
      order,
      fulfillmentRecord
    };

    return {
      order,
      lines: this.context.lines as OrderLine[],
      inventoryMovements,
      fulfillmentRecord
    };
  }
}

function createHarness(status: OrderStatus, inventoryMode: InventoryMode = "stocked") {
  const repository = new FakeOrderLifecycleRepository({
    order: makeOrder(status),
    lines: [makeLine(inventoryMode)]
  });
  const eventBus = new MemoryEventBus();
  const service = new TransitionOrderService(repository, eventBus);

  return { repository, eventBus, service };
}

describe("TransitionOrderService allowed transitions", () => {
  it("allows pending_payment -> confirmed", async () => {
    const { service, eventBus } = createHarness("pending_payment");

    const result = await service.transition({
      orderId: "order_1",
      nextStatus: "confirmed",
      reason: "manual_confirmation"
    });

    expect(result.order.status).toBe("confirmed");
    expect(eventBus.events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
  });

  it("allows confirmed -> cancelled and releases inventory exactly once", async () => {
    const { service, eventBus } = createHarness("confirmed");

    const result = await service.transition({
      orderId: "order_1",
      nextStatus: "cancelled",
      reason: "buyer_cancelled"
    });

    expect(result.order.status).toBe("cancelled");
    expect(result.inventoryMovements.map((movement) => movement.type)).toEqual(["release"]);
    expect(eventBus.events.filter((event) => event.eventType === "inventory_release")).toHaveLength(1);
    expect(eventBus.events.filter((event) => event.eventType === "inventory_deduct")).toHaveLength(0);
    expect(eventBus.events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
  });

  it("allows reserved -> expired and releases inventory exactly once", async () => {
    const { service, eventBus } = createHarness("reserved");

    const result = await service.transition({
      orderId: "order_1",
      nextStatus: "expired",
      reason: "reservation_timeout"
    });

    expect(result.order.status).toBe("expired");
    expect(result.inventoryMovements.map((movement) => movement.type)).toEqual(["release"]);
    expect(eventBus.events.filter((event) => event.eventType === "inventory_release")).toHaveLength(1);
    expect(eventBus.events.filter((event) => event.eventType === "inventory_deduct")).toHaveLength(0);
  });

  it("allows packing -> shipped and emits release plus deduct exactly once", async () => {
    const { service, eventBus } = createHarness("packing");

    const result = await service.transition({
      orderId: "order_1",
      nextStatus: "shipped",
      reason: "handoff_complete",
      fulfillment: {
        bookingReference: "BOOK-1",
        courierName: "Quiqup",
        trackingNumber: "TRK-1"
      }
    });

    expect(result.order.status).toBe("shipped");
    expect(result.inventoryMovements.map((movement) => movement.type)).toEqual(["release", "deduct"]);
    expect(result.fulfillmentRecord?.status).toBe("shipped");
    expect(eventBus.events.filter((event) => event.eventType === "inventory_release")).toHaveLength(1);
    expect(eventBus.events.filter((event) => event.eventType === "inventory_deduct")).toHaveLength(1);
    expect(eventBus.events.filter((event) => event.eventType === "fulfillment_status_changed")).toHaveLength(1);
  });

  it("allows shipped -> delivered and syncs fulfillment exactly once", async () => {
    const { service, eventBus, repository } = createHarness("shipped");
    repository.context.fulfillmentRecord = {
      id: "fulfillment_1",
      sellerId: "seller_1",
      orderId: "order_1",
      status: "shipped",
      trackingNumber: "TRK-1",
      courierName: "Quiqup",
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z"
    };

    const result = await service.transition({
      orderId: "order_1",
      nextStatus: "delivered",
      reason: "delivery_confirmed"
    });

    expect(result.order.status).toBe("delivered");
    expect(result.fulfillmentRecord?.status).toBe("delivered");
    expect(result.inventoryMovements).toHaveLength(0);
    expect(eventBus.events.filter((event) => event.eventType === "fulfillment_status_changed")).toHaveLength(1);
    expect(eventBus.events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
  });
});

describe("TransitionOrderService blocked transitions", () => {
  it("blocks delivered -> confirmed with no side effects", async () => {
    const { service, eventBus, repository } = createHarness("delivered");

    await expect(
      service.transition({
        orderId: "order_1",
        nextStatus: "confirmed",
        reason: "invalid_regression"
      })
    ).rejects.toThrow("Invalid order transition");

    expect(repository.applyCalls).toHaveLength(0);
    expect(eventBus.events).toHaveLength(0);
  });

  it("blocks cancelled -> shipped with no side effects", async () => {
    const { service, eventBus, repository } = createHarness("cancelled");

    await expect(
      service.transition({
        orderId: "order_1",
        nextStatus: "shipped",
        reason: "invalid_transition"
      })
    ).rejects.toThrow("Invalid order transition");

    expect(repository.applyCalls).toHaveLength(0);
    expect(eventBus.events).toHaveLength(0);
  });

  it("blocks expired -> delivered with no side effects", async () => {
    const { service, eventBus, repository } = createHarness("expired");

    await expect(
      service.transition({
        orderId: "order_1",
        nextStatus: "delivered",
        reason: "invalid_transition"
      })
    ).rejects.toThrow("Invalid order transition");

    expect(repository.applyCalls).toHaveLength(0);
    expect(eventBus.events).toHaveLength(0);
  });

  it("blocks shipped -> confirmed regression with no side effects", async () => {
    const { service, eventBus, repository } = createHarness("shipped");

    await expect(
      service.transition({
        orderId: "order_1",
        nextStatus: "confirmed",
        reason: "invalid_regression"
      })
    ).rejects.toThrow("Invalid order transition");

    expect(repository.applyCalls).toHaveLength(0);
    expect(eventBus.events).toHaveLength(0);
  });
});

describe("TransitionOrderService inventory and fulfillment invariants", () => {
  it("does not create inventory actions for service offerings on cancellation", async () => {
    const { service, eventBus } = createHarness("confirmed", "service");

    const result = await service.transition({
      orderId: "order_1",
      nextStatus: "cancelled",
      reason: "service_cancelled"
    });

    expect(result.inventoryMovements).toHaveLength(0);
    expect(eventBus.events.filter((event) => event.eventType === "inventory_release")).toHaveLength(0);
  });

  it("does not update fulfillment for transitions that do not require it", async () => {
    const { service } = createHarness("confirmed");

    const result = await service.transition({
      orderId: "order_1",
      nextStatus: "cancelled",
      reason: "buyer_cancelled"
    });

    expect(result.fulfillmentRecord).toBeUndefined();
  });
});
