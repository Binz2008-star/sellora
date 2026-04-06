import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createSelloraHttpHandlers } from "../../src/api/http/handlers.js";
import type { HttpAccessRepository } from "../../src/ports/http-access-repository.js";
import type { PaymentAttemptContext } from "../../src/ports/payment-repository.js";
import type { Order, FulfillmentRecord } from "../../src/domain/orders/order.js";
import type { NormalizedShippingWebhook } from "../../src/adapters/karrio/karrio-webhook-ingress.js";

function makeOrder(status: Order["status"] = "pending_payment"): Order {
  return {
    id: "order_1",
    sellerId: "seller_1",
    customerId: "customer_1",
    orderNumber: "SOR-HTTP-1",
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

function makePaymentContext(): PaymentAttemptContext {
  return {
    attempt: {
      id: "pay_1",
      sellerId: "seller_1",
      orderId: "order_1",
      provider: "stripe",
      status: "pending",
      amount: { amountMinor: 10000, currency: "AED" },
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z"
    },
    order: makeOrder()
  };
}

class FakeHttpAccessRepository implements HttpAccessRepository {
  constructor(
    private readonly orderSellerId: string | null = "seller_1",
    private readonly paymentSellerId: string | null = "seller_1"
  ) {}

  async getOrderSellerId(): Promise<string | null> {
    return this.orderSellerId;
  }

  async getPaymentAttemptSellerId(): Promise<string | null> {
    return this.paymentSellerId;
  }
}

class FakePaymentService {
  initiatePaymentAttempt = vi.fn(async () => makePaymentContext());
  markProcessing = vi.fn(async () => ({
    ...makePaymentContext(),
    attempt: {
      ...makePaymentContext().attempt,
      status: "processing" as const
    }
  }));
  markSucceeded = vi.fn(async () => ({
    ...makePaymentContext(),
    attempt: {
      ...makePaymentContext().attempt,
      status: "paid" as const,
      providerReference: "pi_1"
    },
    order: makeOrder("confirmed")
  }));
  markFailed = vi.fn(async () => ({
    ...makePaymentContext(),
    attempt: {
      ...makePaymentContext().attempt,
      status: "failed" as const
    },
    order: {
      ...makeOrder(),
      paymentStatus: "failed"
    }
  }));
}

class FakeBookOrderShipmentService {
  execute = vi.fn(async () => ({
    duplicateBooking: false,
    booking: {
      success: true,
      provider: "karrio",
      providerReference: "ship_1"
    }
  }));
}

class FakeConfirmOrderDeliveryService {
  execute = vi.fn(async () => ({
    duplicateConfirmation: false,
    context: {
      order: makeOrder("shipped"),
      fulfillmentRecord: {
        id: "fulfillment_1",
        sellerId: "seller_1",
        orderId: "order_1",
        status: "shipped",
        createdAt: "2026-04-06T00:00:00.000Z",
        updatedAt: "2026-04-06T00:00:00.000Z"
      } as FulfillmentRecord
    }
  }));
}

class FakeHandleShippingWebhookService {
  calls: NormalizedShippingWebhook[] = [];
  duplicates = new Set<string>();

  async execute(webhook: NormalizedShippingWebhook) {
    this.calls.push(webhook);
    if (this.duplicates.has(webhook.idempotencyKey)) {
      return {
        duplicate: true,
        deliveredHandoff: false
      };
    }

    this.duplicates.add(webhook.idempotencyKey);
    return {
      duplicate: false,
      deliveredHandoff: webhook.normalizedStatus === "delivered"
    };
  }
}

class FakeReconcileShipmentStatusService {
  execute = vi.fn(async () => ({
    duplicate: false,
    deliveredHandoff: true,
    noChange: false
  }));
}

function buildRequest(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Request {
  const headers = new Headers(init.headers);
  let body = init.body;

  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    headers.set("content-type", "application/json");
  }

  return new Request(`https://sellora.test${path}`, {
    method: init.method ?? "POST",
    headers,
    body
  });
}

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function createHandlers(accessRepository: HttpAccessRepository = new FakeHttpAccessRepository()) {
  const paymentService = new FakePaymentService();
  const bookOrderShipmentService = new FakeBookOrderShipmentService();
  const confirmOrderDeliveryService = new FakeConfirmOrderDeliveryService();
  const handleShippingWebhookService = new FakeHandleShippingWebhookService();
  const reconcileShipmentStatusService = new FakeReconcileShipmentStatusService();

  const handlers = createSelloraHttpHandlers({
    accessRepository,
    paymentService,
    bookOrderShipmentService,
    confirmOrderDeliveryService,
    handleShippingWebhookService,
    reconcileShipmentStatusService,
    operatorApiToken: "operator-secret",
    paymentWebhookSecret: "payment-secret",
    karrioWebhookSecret: "shipping-secret"
  });

  return {
    handlers,
    paymentService,
    bookOrderShipmentService,
    confirmOrderDeliveryService,
    handleShippingWebhookService,
    reconcileShipmentStatusService
  };
}

describe("Sellora HTTP handlers", () => {
  it("rejects unauthorized operator calls before service execution", async () => {
    const { handlers, paymentService } = createHandlers();
    const response = await handlers.initiatePayment(
      buildRequest("/api/payments/attempts", {
        json: {
          orderId: "order_1",
          provider: "stripe",
          amountMinor: 10000,
          currency: "AED"
        }
      })
    );

    expect(response.status).toBe(401);
    expect(paymentService.initiatePaymentAttempt).not.toHaveBeenCalled();
  });

  it("rejects invalid body payloads with validation errors", async () => {
    const { handlers, bookOrderShipmentService } = createHandlers();
    const response = await handlers.bookShipment(
      buildRequest("/api/fulfillment/shipments/book", {
        headers: {
          authorization: "Bearer operator-secret",
          "x-sellora-seller-id": "seller_1"
        },
        json: {
          orderId: ""
        }
      })
    );

    expect(response.status).toBe(400);
    expect(bookOrderShipmentService.execute).not.toHaveBeenCalled();
  });

  it("blocks operator access when resource belongs to a different seller", async () => {
    const { handlers, reconcileShipmentStatusService } = createHandlers(
      new FakeHttpAccessRepository("seller_2")
    );
    const response = await handlers.reconcileShipment(
      buildRequest("/api/fulfillment/shipments/reconcile", {
        headers: {
          authorization: "Bearer operator-secret",
          "x-sellora-seller-id": "seller_1"
        },
        json: {
          orderId: "order_1"
        }
      })
    );

    expect(response.status).toBe(403);
    expect(reconcileShipmentStatusService.execute).not.toHaveBeenCalled();
  });

  it("wires initiate payment route to payment service with idempotency key", async () => {
    const { handlers, paymentService } = createHandlers();
    const response = await handlers.initiatePayment(
      buildRequest("/api/payments/attempts", {
        headers: {
          authorization: "Bearer operator-secret",
          "x-sellora-seller-id": "seller_1",
          "idempotency-key": "idem_1"
        },
        json: {
          orderId: "order_1",
          provider: "stripe",
          amountMinor: 10000,
          currency: "AED"
        }
      })
    );

    expect(response.status).toBe(201);
    expect(paymentService.initiatePaymentAttempt).toHaveBeenCalledWith({
      sellerId: "seller_1",
      orderId: "order_1",
      provider: "stripe",
      amountMinor: 10000,
      currency: "AED",
      idempotencyKey: "idem_1",
      metadata: undefined,
      rawPayload: undefined
    });
  });

  it("dedupes repeated shipping webhook delivery through the HTTP boundary", async () => {
    const { handlers, handleShippingWebhookService } = createHandlers();
    const rawBody = JSON.stringify({
      type: "tracker.updated",
      data: {
        id: "ship_ref_1",
        tracking_number: "TRK-1",
        status: "delivered",
        updated_at: "2026-04-06T00:00:00.000Z"
      }
    });
    const signature = sign(rawBody, "shipping-secret");

    const first = await handlers.shippingWebhook(
      buildRequest("/api/fulfillment/webhooks/karrio", {
        headers: {
          "x-karrio-signature": signature
        },
        body: rawBody
      })
    );
    const second = await handlers.shippingWebhook(
      buildRequest("/api/fulfillment/webhooks/karrio", {
        headers: {
          "x-karrio-signature": signature
        },
        body: rawBody
      })
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual({
      duplicate: false,
      deliveredHandoff: true
    });
    expect(await second.json()).toEqual({
      duplicate: true,
      deliveredHandoff: false
    });
    expect(handleShippingWebhookService.calls).toHaveLength(2);
    expect(handleShippingWebhookService.calls[0].idempotencyKey).toBe(
      handleShippingWebhookService.calls[1].idempotencyKey
    );
  });

  it("rejects invalid payment webhook signatures", async () => {
    const { handlers, paymentService } = createHandlers();
    const response = await handlers.paymentWebhook(
      buildRequest("/api/payments/webhooks/generic", {
        headers: {
          "x-sellora-payment-signature": "sha256=bad"
        },
        body: JSON.stringify({
          paymentAttemptId: "pay_1",
          provider: "stripe",
          event: "payment.failed"
        })
      })
    );

    expect(response.status).toBe(401);
    expect(paymentService.markFailed).not.toHaveBeenCalled();
  });
});
