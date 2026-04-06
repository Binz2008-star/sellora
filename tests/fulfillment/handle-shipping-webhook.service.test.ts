import { describe, expect, it } from "vitest";
import type { EventEnvelope } from "../../src/domain/events/event-envelope.js";
import { createIdempotencyKey } from "../../src/modules/events/idempotency.js";
import { HandleShippingWebhookService } from "../../src/application/fulfillment/handle-shipping-webhook.service.js";
import type {
  FulfillmentRecord,
  Order
} from "../../src/domain/orders/order.js";
import type {
  FulfillmentRepository,
  ShippingWebhookContext,
  UpsertProviderStatusInput
} from "../../src/ports/fulfillment-repository.js";
import type {
  ShippingWebhookReceiptInput,
  ShippingWebhookRepository
} from "../../src/ports/shipping-webhook-repository.js";
import type { RepositoryTransaction } from "../../src/ports/repository-transaction.js";
import type { EventBus } from "../../src/ports/event-bus.js";
import type { NormalizedShippingWebhook } from "../../src/adapters/karrio/karrio-webhook-ingress.js";

function makeOrder(status: Order["status"]): Order {
  return {
    id: "order_1",
    sellerId: "seller_1",
    customerId: "customer_1",
    orderNumber: "SOR-WEB-1",
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
    bookingReference: "ship_ref_1",
    trackingNumber: "TRK-1",
    courierName: "karrio",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z"
  };
}

function makeWebhook(status: string, overrides: Partial<NormalizedShippingWebhook> = {}): NormalizedShippingWebhook {
  return {
    provider: "karrio",
    eventType: "tracker.updated",
    idempotencyKey: createIdempotencyKey(["karrio", status, "ship_ref_1"]),
    providerReference: "ship_ref_1",
    trackingNumber: "TRK-1",
    normalizedStatus: status,
    rawPayload: { status },
    receivedAt: "2026-04-06T00:00:00.000Z",
    ...overrides
  };
}

class FakeShippingWebhookRepository implements ShippingWebhookRepository {
  receipts: ShippingWebhookReceiptInput[] = [];
  duplicateKeys = new Set<string>();

  async withTransaction<T>(work: (transaction: RepositoryTransaction) => Promise<T>): Promise<T> {
    return work({} as RepositoryTransaction);
  }

  async recordReceipt(input: ShippingWebhookReceiptInput) {
    if (this.duplicateKeys.has(input.idempotencyKey)) {
      return { duplicate: true };
    }

    this.duplicateKeys.add(input.idempotencyKey);
    this.receipts.push(input);
    return { duplicate: false };
  }
}

class FakeFulfillmentRepository implements FulfillmentRepository {
  updates: UpsertProviderStatusInput[] = [];

  constructor(private readonly context: ShippingWebhookContext | null) {}

  async getShipmentContext() {
    throw new Error("not used");
  }

  async getDeliveryContext(orderId: string) {
    if (!this.context || this.context.order.id !== orderId) {
      return null;
    }

    return {
      order: this.context.order,
      fulfillmentRecord: this.context.fulfillmentRecord
    };
  }

  async findWebhookContext() {
    return this.context;
  }

  async updateProviderStatus(input: UpsertProviderStatusInput) {
    this.updates.push(input);
    return {
      ...this.context!.fulfillmentRecord,
      providerStatus: input.providerStatus,
      rawPayload: input.rawPayload,
      lastWebhookAt: input.receivedAt
    };
  }
}

class FakeConfirmOrderDeliveryService {
  calls: Array<{ orderId: string }> = [];

  constructor(private readonly duplicateConfirmation = false) {}

  async execute(input: { orderId: string }) {
    this.calls.push(input);
    return {
      context: {
        order: makeOrder(this.duplicateConfirmation ? "delivered" : "shipped"),
        fulfillmentRecord: makeFulfillmentRecord(this.duplicateConfirmation ? "delivered" : "shipped")
      },
      duplicateConfirmation: this.duplicateConfirmation,
      transition: this.duplicateConfirmation
        ? undefined
        : {
            order: makeOrder("delivered"),
            fulfillmentRecord: makeFulfillmentRecord("delivered"),
            inventoryMovements: [],
            pendingExternalEvents: [
              {
                id: "evt_1",
                aggregateType: "order",
                aggregateId: "order_1",
                eventType: "order_status_changed",
                occurredAt: "2026-04-06T00:00:00.000Z",
                idempotencyKey: "evt_1",
                payload: {}
              }
            ] as EventEnvelope[]
          }
    };
  }
}

class MemoryEventBus implements EventBus {
  events: EventEnvelope[] = [];

  async publish(event: EventEnvelope): Promise<void> {
    this.events.push(event);
  }
}

function createHarness(
  orderStatus: Order["status"] = "shipped",
  duplicateConfirmation = false
) {
  const shippingWebhookRepository = new FakeShippingWebhookRepository();
  const fulfillmentRepository = new FakeFulfillmentRepository({
    order: makeOrder(orderStatus),
    fulfillmentRecord: makeFulfillmentRecord(orderStatus === "delivered" ? "delivered" : "shipped")
  });
  const confirmOrderDeliveryService = new FakeConfirmOrderDeliveryService(duplicateConfirmation);
  const eventBus = new MemoryEventBus();
  const service = new HandleShippingWebhookService(
    shippingWebhookRepository,
    fulfillmentRepository,
    confirmOrderDeliveryService as never,
    eventBus
  );

  return {
    shippingWebhookRepository,
    fulfillmentRepository,
    confirmOrderDeliveryService,
    eventBus,
    service
  };
}

describe("HandleShippingWebhookService", () => {
  it("hands off delivered status to delivery authority exactly once", async () => {
    const { service, confirmOrderDeliveryService, fulfillmentRepository, eventBus } = createHarness("shipped");

    const result = await service.execute(makeWebhook("delivered"));

    expect(result.duplicate).toBe(false);
    expect(result.deliveredHandoff).toBe(true);
    expect(confirmOrderDeliveryService.calls).toHaveLength(1);
    expect(fulfillmentRepository.updates).toHaveLength(1);
    expect(fulfillmentRepository.updates[0].providerStatus).toBe("delivered");
    expect(eventBus.events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
  });

  it("treats repeated webhook delivery as duplicate with no extra effects", async () => {
    const { service, confirmOrderDeliveryService, fulfillmentRepository } = createHarness("shipped");
    const webhook = makeWebhook("delivered");

    await service.execute(webhook);
    const result = await service.execute(webhook);

    expect(result.duplicate).toBe(true);
    expect(confirmOrderDeliveryService.calls).toHaveLength(1);
    expect(fulfillmentRepository.updates).toHaveLength(1);
  });

  it("does not regress orders on delivered webhook when order is already delivered", async () => {
    const { service, confirmOrderDeliveryService, eventBus } = createHarness("delivered", true);

    const result = await service.execute(makeWebhook("delivered"));

    expect(result.duplicate).toBe(false);
    expect(result.deliveredHandoff).toBe(false);
    expect(confirmOrderDeliveryService.calls).toHaveLength(1);
    expect(eventBus.events).toHaveLength(0);
  });
});
