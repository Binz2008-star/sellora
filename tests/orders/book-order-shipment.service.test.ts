import { describe, expect, it } from "vitest";
import type { Order } from "../../src/domain/orders/order.js";
import { BookOrderShipmentService } from "../../src/application/orders/book-order-shipment.service.js";
import type {
  FulfillmentRepository,
  FulfillmentShipmentContext
} from "../../src/ports/fulfillment-repository.js";
import type {
  ShipmentBookingRequest,
  ShipmentBookingResult,
  ShippingGateway
} from "../../src/ports/shipping-gateway.js";

function makeOrder(status: Order["status"]): Order {
  return {
    id: "order_1",
    sellerId: "seller_1",
    customerId: "customer_1",
    orderNumber: "SOR-FUL-1",
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

class FakeFulfillmentRepository implements FulfillmentRepository {
  constructor(private readonly context: FulfillmentShipmentContext | null) {}

  async getShipmentContext(orderId: string): Promise<FulfillmentShipmentContext | null> {
    if (!this.context || this.context.order.id !== orderId) {
      return null;
    }

    return this.context;
  }
}

class FakeShippingGateway implements ShippingGateway {
  calls: ShipmentBookingRequest[] = [];

  constructor(
    private readonly result: ShipmentBookingResult = {
      success: true,
      provider: "karrio",
      providerReference: "BOOK-1",
      bookingReference: "BOOK-1",
      courierName: "Quiqup",
      trackingNumber: "TRK-1",
      trackingUrl: "https://track.example/TRK-1",
      rawPayload: {
        shipment_id: "BOOK-1"
      }
    }
  ) {}

  async bookShipment(request: ShipmentBookingRequest): Promise<ShipmentBookingResult> {
    this.calls.push(request);
    return this.result;
  }
}

class FailingShippingGateway implements ShippingGateway {
  async bookShipment(): Promise<ShipmentBookingResult> {
    return {
      success: false,
      provider: "karrio",
      failureCode: "provider_error",
      failureMessage: "gateway unavailable",
      rawPayload: {
        error: "gateway unavailable"
      }
    };
  }
}

class FakeTransitionOrderService {
  calls: Array<{
    orderId: string;
    nextStatus: Order["status"];
    reason?: string;
    fulfillment?: {
      bookingReference?: string;
      courierName?: string;
      trackingNumber?: string;
    };
  }> = [];

  async transition(input: {
    orderId: string;
    nextStatus: Order["status"];
    reason?: string;
    fulfillment?: {
      bookingReference?: string;
      courierName?: string;
      trackingNumber?: string;
    };
  }) {
    this.calls.push(input);

    return {
      order: {
        ...makeOrder("shipped"),
        id: input.orderId
      },
      inventoryMovements: [],
      pendingExternalEvents: []
    };
  }
}

function createHarness(status: Order["status"]) {
  const repository = new FakeFulfillmentRepository({
    order: makeOrder(status),
    destinationCity: "Dubai",
    fulfillmentRecord:
      status === "shipped"
        ? {
            id: "fulfillment_1",
            sellerId: "seller_1",
            orderId: "order_1",
            status: "shipped",
            bookingReference: "BOOK-EXISTING",
            courierName: "Quiqup",
            trackingNumber: "TRK-EXISTING",
            trackingUrl: "https://track.example/TRK-EXISTING",
            rawPayload: {
              shipment_id: "BOOK-EXISTING"
            },
            createdAt: "2026-04-06T00:00:00.000Z",
            updatedAt: "2026-04-06T00:00:00.000Z"
          }
        : undefined,
    lines: [
      {
        productOfferingId: "offering_1",
        titleSnapshot: "Test Device",
        quantity: 2
      }
    ]
  });
  const shippingGateway = new FakeShippingGateway();
  const transitionOrderService = new FakeTransitionOrderService();
  const service = new BookOrderShipmentService(
    repository,
    shippingGateway,
    transitionOrderService
  );

  return { repository, shippingGateway, transitionOrderService, service };
}

describe("BookOrderShipmentService", () => {
  it("books shipment for packing order and transitions through lifecycle authority", async () => {
    const { service, shippingGateway, transitionOrderService } = createHarness("packing");

    const result = await service.execute({
      orderId: "order_1"
    });

    expect(shippingGateway.calls).toHaveLength(1);
    expect(shippingGateway.calls[0]).toEqual({
      orderId: "order_1",
      destinationCity: "Dubai",
      items: [
        {
          title: "Test Device",
          quantity: 2
        }
      ]
    });
    expect(transitionOrderService.calls).toHaveLength(1);
    expect(transitionOrderService.calls[0]).toEqual({
      orderId: "order_1",
      nextStatus: "shipped",
      reason: "shipment_booked",
      fulfillment: {
        bookingReference: "BOOK-1",
        courierName: "Quiqup",
        trackingNumber: "TRK-1",
        trackingUrl: "https://track.example/TRK-1",
        rawPayload: {
          shipment_id: "BOOK-1"
        }
      }
    });
    expect(result.duplicateBooking).toBe(false);
    expect(result.booking.providerReference).toBe("BOOK-1");
    expect(result.transition.order.status).toBe("shipped");
  });

  it("rejects non-packing orders before calling shipping gateway", async () => {
    const { service, shippingGateway, transitionOrderService } = createHarness("confirmed");

    await expect(
      service.execute({
        orderId: "order_1"
      })
    ).rejects.toThrow("is not ready for shipment booking");

    expect(shippingGateway.calls).toHaveLength(0);
    expect(transitionOrderService.calls).toHaveLength(0);
  });

  it("does not transition order when shipping gateway fails", async () => {
    const repository = new FakeFulfillmentRepository({
      order: makeOrder("packing"),
      destinationCity: "Dubai",
      lines: [
        {
          productOfferingId: "offering_1",
          titleSnapshot: "Test Device",
          quantity: 1
        }
      ]
    });
    const transitionOrderService = new FakeTransitionOrderService();
    const service = new BookOrderShipmentService(
      repository,
      new FailingShippingGateway(),
      transitionOrderService
    );

    await expect(
      service.execute({
        orderId: "order_1"
      })
    ).rejects.toThrow("gateway unavailable");

    expect(transitionOrderService.calls).toHaveLength(0);
  });

  it("treats repeated booking on shipped order as idempotent", async () => {
    const { service, shippingGateway, transitionOrderService } = createHarness("shipped");

    const result = await service.execute({
      orderId: "order_1"
    });

    expect(result.duplicateBooking).toBe(true);
    expect(result.transition).toBeUndefined();
    expect(result.booking.providerReference).toBe("BOOK-EXISTING");
    expect(shippingGateway.calls).toHaveLength(0);
    expect(transitionOrderService.calls).toHaveLength(0);
  });
});
