import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createSelloraHttpHandlers } from "../../src/api/http/handlers.js";
import type { NotificationLog } from "../../src/domain/notifications/notification.js";
import type { HttpAccessRepository } from "../../src/ports/http-access-repository.js";
import type { CreateTenantResult } from "../../src/ports/tenant-repository.js";
import type { OperatorNotificationSummary } from "../../src/ports/notification-query-repository.js";
import type {
  OperatorOrderDetail,
  OperatorOrderTimelineEntry,
  OperatorQueryRepository,
  OperatorShippingWebhookReceipt
} from "../../src/ports/operator-query-repository.js";
import type { PaymentAttemptContext } from "../../src/ports/payment-repository.js";
import type { Order, FulfillmentRecord } from "../../src/domain/orders/order.js";
import type { NormalizedShippingWebhook } from "../../src/adapters/karrio/karrio-webhook-ingress.js";
import type { PaymentAttempt } from "../../src/domain/payments/payment.js";
import type {
  RetrievalBenchmarkDatasetSummary,
  RetrievalBenchmarkSummary,
  RetrievalSearchResult
} from "../../src/domain/retrieval/retrieval.js";

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
    private readonly paymentSellerId: string | null = "seller_1",
    private readonly notificationSellerId: string | null = "seller_1"
  ) {}

  async getOrderSellerId(): Promise<string | null> {
    return this.orderSellerId;
  }

  async getPaymentAttemptSellerId(): Promise<string | null> {
    return this.paymentSellerId;
  }

  async getNotificationSellerId(): Promise<string | null> {
    return this.notificationSellerId;
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

class FakeHealthCheckService {
  getHealth = vi.fn(() => ({
    status: "ok" as const,
    appName: "sellora",
    environment: "test" as const,
    uptimeSeconds: 1
  }));

  getReadiness = vi.fn(async () => ({
    status: "ready" as const,
    checks: {
      database: "ok" as const
    }
  }));
}

class FakeCreateTenantService {
  execute = vi.fn(async (): Promise<CreateTenantResult> => ({
    user: {
      id: "user_1",
      email: "seller@sellora.test",
      fullName: "Seller One",
      isActive: true,
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z"
    },
    seller: {
      id: "seller_1",
      ownerUserId: "user_1",
      slug: "seller-one",
      displayName: "Seller One",
      status: "active",
      defaultCurrency: "AED",
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z"
    }
  }));
}

class FakeRunRetrievalQueryService {
  execute = vi.fn(async (): Promise<RetrievalSearchResult> => ({
    query: {
      text: "refund payment",
      language: "en",
      topK: 5
    },
    hits: [
      {
        documentId: "doc_1",
        score: 1,
        rank: 1
      }
    ]
  }));
}

class FakeEvaluateRetrievalBenchmarkService {
  execute = vi.fn(async (): Promise<RetrievalBenchmarkSummary> => ({
    datasetName: "support-search-smoke",
    caseCount: 1,
    topK: 5,
    averageRecallAtK: 1,
    averageNdcgAtK: 1,
    failures: []
  }));
}

class FakeGetRetrievalBenchmarkDatasetService {
  list = vi.fn((): RetrievalBenchmarkDatasetSummary[] => [
    {
      id: "sellora-retrieval-smoke-v1",
      name: "Sellora Retrieval Smoke v1",
      description: "Internal retrieval smoke benchmark",
      useCases: ["support_search", "help_center_grounding", "catalog_candidate_retrieval"],
      caseCount: 6,
      corpusDocumentCount: 6
    }
  ]);

  getOrThrow = vi.fn((datasetId: string) => ({
    id: datasetId,
    name: "Sellora Retrieval Smoke v1",
    description: "Internal retrieval smoke benchmark",
    useCases: ["support_search", "help_center_grounding", "catalog_candidate_retrieval"] as const,
    corpus: [
      {
        id: "doc_1",
        language: "en",
        title: "Refund payment issue",
        body: "Refunds for failed payments"
      }
    ],
    cases: [
      {
        id: "case_1",
        query: "refund payment",
        language: "en",
        useCase: "support_search" as const,
        relevantDocumentIds: ["doc_1"],
        expectedPrimaryDocumentId: "doc_1",
        tags: ["support"]
      }
    ]
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

function makeNotification(
  overrides: Partial<OperatorNotificationSummary> = {}
): OperatorNotificationSummary {
  return {
    id: "notification_1",
    sellerId: "seller_1",
    orderId: "order_1",
    orderNumber: "SOR-HTTP-1",
    channel: "email",
    status: "sent",
    recipientRole: "customer",
    recipientAddress: "customer@sellora.test",
    templateKey: "payment_succeeded",
    eventType: "payment_succeeded",
    eventIdempotencyKey: "event_1",
    notificationKey: "notify_1",
    subject: "Payment received",
    body: "Hello",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides
  };
}

class FakeNotificationQueryRepository {
  listNotifications = vi.fn(async (): Promise<OperatorNotificationSummary[]> => [
    makeNotification(),
    makeNotification({
      id: "notification_2",
      status: "failed",
      recipientRole: "operator",
      recipientAddress: "owner@sellora.test",
      templateKey: "shipment_booked",
      eventType: "order_status_changed",
      notificationKey: "notify_2",
      subject: "Shipment issue"
    })
  ]);

  getNotificationDetail = vi.fn(async (notificationId: string): Promise<OperatorNotificationSummary | null> => {
    if (notificationId === "missing") {
      return null;
    }

    return makeNotification({
      id: notificationId
    });
  });
}

class FakeAcknowledgeNotificationService {
  execute = vi.fn(async ({ notificationId, sellerId }: { notificationId: string; sellerId: string }): Promise<NotificationLog> =>
    makeNotification({
      id: notificationId,
      acknowledgedAt: "2026-04-06T01:00:00.000Z",
      acknowledgedBySellerId: sellerId
    })
  );
}

class FakeOperatorQueryRepository implements OperatorQueryRepository {
  getOrderDetail = vi.fn(async (): Promise<OperatorOrderDetail> => ({
    order: makeOrder("shipped"),
    customer: {
      id: "customer_1",
      name: "Customer One",
      phone: "+971500000000",
      city: "Dubai"
    },
    lines: [
      {
        id: "line_1",
        orderId: "order_1",
        productId: "product_1",
        productOfferingId: "offering_1",
        titleSnapshot: "Device One",
        quantity: 1,
        unitPrice: { amountMinor: 10000, currency: "AED" },
        costPrice: { amountMinor: 7000, currency: "AED" },
        currencySnapshot: "AED",
        selectedAttributesSnapshot: {},
        lineTotal: { amountMinor: 10000, currency: "AED" }
      }
    ]
  }));

  listPaymentAttempts = vi.fn(async (): Promise<PaymentAttempt[]> => [
    {
      id: "pay_1",
      sellerId: "seller_1",
      orderId: "order_1",
      provider: "stripe",
      providerReference: "pi_1",
      idempotencyKey: "idem_1",
      status: "paid",
      amount: { amountMinor: 10000, currency: "AED" },
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z"
    }
  ]);

  getFulfillment = vi.fn(async (): Promise<FulfillmentRecord> => ({
    id: "fulfillment_1",
    sellerId: "seller_1",
    orderId: "order_1",
    status: "shipped",
    bookingReference: "ship_1",
    courierName: "karrio",
    trackingNumber: "TRK-1",
    trackingUrl: "https://track.example/TRK-1",
    providerStatus: "in_transit",
    lastWebhookAt: "2026-04-06T00:00:00.000Z",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z"
  }));

  listOrderTimeline = vi.fn(async (): Promise<OperatorOrderTimelineEntry[]> => [
    {
      id: "evt_1",
      eventType: "order_status_changed",
      payload: {
        from: "packing",
        to: "shipped"
      },
      createdAt: "2026-04-06T00:00:00.000Z"
    }
  ]);

  listShippingWebhookReceipts = vi.fn(async (): Promise<OperatorShippingWebhookReceipt[]> => [
    {
      id: "receipt_1",
      provider: "karrio",
      eventType: "tracker.updated",
      idempotencyKey: "karrio:evt",
      providerReference: "ship_1",
      trackingNumber: "TRK-1",
      normalizedStatus: "delivered",
      rawPayload: {
        status: "delivered"
      },
      receivedAt: "2026-04-06T00:00:00.000Z",
      createdAt: "2026-04-06T00:00:00.000Z",
      updatedAt: "2026-04-06T00:00:00.000Z"
    }
  ]);

  listNotificationsByOrder = vi.fn(async (): Promise<OperatorNotificationSummary[]> => [
    makeNotification()
  ]);
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
  const healthCheckService = new FakeHealthCheckService();
  const createTenantService = new FakeCreateTenantService();
  const runRetrievalQueryService = new FakeRunRetrievalQueryService();
  const evaluateRetrievalBenchmarkService = new FakeEvaluateRetrievalBenchmarkService();
  const getRetrievalBenchmarkDatasetService = new FakeGetRetrievalBenchmarkDatasetService();
  const bookOrderShipmentService = new FakeBookOrderShipmentService();
  const confirmOrderDeliveryService = new FakeConfirmOrderDeliveryService();
  const handleShippingWebhookService = new FakeHandleShippingWebhookService();
  const reconcileShipmentStatusService = new FakeReconcileShipmentStatusService();
  const operatorQueryRepository = new FakeOperatorQueryRepository();
  const notificationQueryRepository = new FakeNotificationQueryRepository();
  const acknowledgeNotificationService = new FakeAcknowledgeNotificationService();

  const handlers = createSelloraHttpHandlers({
    accessRepository,
    operatorQueryRepository,
    notificationQueryRepository,
    createTenantService,
    runRetrievalQueryService,
    evaluateRetrievalBenchmarkService,
    getRetrievalBenchmarkDatasetService,
    acknowledgeNotificationService,
    healthCheckService,
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
    healthCheckService,
    createTenantService,
    runRetrievalQueryService,
    evaluateRetrievalBenchmarkService,
    getRetrievalBenchmarkDatasetService,
    paymentService,
    bookOrderShipmentService,
    confirmOrderDeliveryService,
    handleShippingWebhookService,
    reconcileShipmentStatusService,
    operatorQueryRepository,
    notificationQueryRepository,
    acknowledgeNotificationService
  };
}

describe("Sellora HTTP handlers", () => {
  it("exposes health and readiness probes without auth", async () => {
    const { handlers, healthCheckService } = createHandlers();

    const healthResponse = await handlers.health();
    const readinessResponse = await handlers.readiness();

    expect(healthResponse.status).toBe(200);
    expect(readinessResponse.status).toBe(200);
    expect(healthCheckService.getHealth).toHaveBeenCalled();
    expect(healthCheckService.getReadiness).toHaveBeenCalled();
    expect(await healthResponse.json()).toMatchObject({
      status: "ok",
      appName: "sellora"
    });
    expect(await readinessResponse.json()).toEqual({
      status: "ready",
      checks: {
        database: "ok"
      }
    });
  });

  it("rejects unauthorized operator calls before service execution", async () => {
    const { handlers, paymentService, createTenantService } = createHandlers();
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
    expect(createTenantService.execute).not.toHaveBeenCalled();
  });

  it("creates a tenant through the admin route without seller scoping headers", async () => {
    const { handlers, createTenantService } = createHandlers();

    const response = await handlers.createTenant(
      buildRequest("/api/admin/tenants", {
        headers: {
          authorization: "Bearer operator-secret"
        },
        json: {
          email: "seller@sellora.test",
          fullName: "Seller One",
          brandName: "Seller One",
          slug: "seller-one",
          whatsappNumber: "+971500000001"
        }
      })
    );

    expect(response.status).toBe(201);
    expect(createTenantService.execute).toHaveBeenCalledWith({
      email: "seller@sellora.test",
      fullName: "Seller One",
      brandName: "Seller One",
      slug: "seller-one",
      whatsappNumber: "+971500000001"
    });
    expect((await response.json()).tenant.seller.slug).toBe("seller-one");
  });

  it("runs admin retrieval query experiments behind operator auth", async () => {
    const { handlers, runRetrievalQueryService } = createHandlers();

    const response = await handlers.runRetrievalQuery(
      buildRequest("/api/admin/retrieval/query", {
        headers: {
          authorization: "Bearer operator-secret"
        },
        json: {
          query: "refund payment",
          language: "en",
          topK: 5,
          corpus: [
            {
              id: "doc_1",
              language: "en",
              title: "Refund payment issue",
              body: "Refunds for failed payments"
            }
          ]
        }
      })
    );

    expect(response.status).toBe(200);
    expect(runRetrievalQueryService.execute).toHaveBeenCalledWith({
      query: "refund payment",
      language: "en",
      topK: 5,
      corpus: [
        {
          id: "doc_1",
          language: "en",
          title: "Refund payment issue",
          body: "Refunds for failed payments"
        }
      ]
    });
    expect((await response.json()).result.hits[0]?.documentId).toBe("doc_1");
  });

  it("lists built-in retrieval benchmarks behind operator auth", async () => {
    const { handlers, getRetrievalBenchmarkDatasetService } = createHandlers();

    const response = await handlers.listRetrievalBenchmarks(
      buildRequest("/api/admin/retrieval/benchmarks", {
        method: "GET",
        headers: {
          authorization: "Bearer operator-secret"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(getRetrievalBenchmarkDatasetService.list).toHaveBeenCalled();
    expect((await response.json()).datasets[0].id).toBe("sellora-retrieval-smoke-v1");
  });

  it("evaluates retrieval benchmarks behind operator auth", async () => {
    const { handlers, evaluateRetrievalBenchmarkService } = createHandlers();

    const response = await handlers.evaluateRetrievalBenchmark(
      buildRequest("/api/admin/retrieval/benchmark/evaluate", {
        headers: {
          authorization: "Bearer operator-secret"
        },
        json: {
          dataset: {
            name: "support-search-smoke",
            corpus: [
              {
                id: "doc_1",
                language: "en",
                title: "Refund payment issue",
                body: "Refunds for failed payments"
              }
            ],
            cases: [
              {
                id: "case_1",
                query: "refund payment",
                language: "en",
                useCase: "support_search",
                relevantDocumentIds: ["doc_1"]
              }
            ]
          },
          topK: 5
        }
      })
    );

    expect(response.status).toBe(200);
    expect(evaluateRetrievalBenchmarkService.execute).toHaveBeenCalled();
    expect((await response.json()).summary.averageRecallAtK).toBe(1);
  });

  it("evaluates a built-in retrieval benchmark by dataset id", async () => {
    const {
      handlers,
      evaluateRetrievalBenchmarkService,
      getRetrievalBenchmarkDatasetService
    } = createHandlers();

    const response = await handlers.evaluateBuiltInRetrievalBenchmark(
      buildRequest("/api/admin/retrieval/benchmark/evaluate/sellora-retrieval-smoke-v1", {
        headers: {
          authorization: "Bearer operator-secret"
        },
        json: {
          topK: 5,
          failureRecallThreshold: 1
        }
      }),
      { datasetId: "sellora-retrieval-smoke-v1" }
    );

    expect(response.status).toBe(200);
    expect(getRetrievalBenchmarkDatasetService.getOrThrow).toHaveBeenCalledWith(
      "sellora-retrieval-smoke-v1"
    );
    expect(evaluateRetrievalBenchmarkService.execute).toHaveBeenCalledWith({
      dataset: expect.objectContaining({
        id: "sellora-retrieval-smoke-v1"
      }),
      topK: 5,
      failureRecallThreshold: 1
    });
    expect((await response.json()).summary.averageRecallAtK).toBe(1);
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

  it("returns order, payments, fulfillment, timeline, and webhook visibility for scoped operator reads", async () => {
    const {
      handlers,
      operatorQueryRepository
    } = createHandlers();
    const headers = {
      authorization: "Bearer operator-secret",
      "x-sellora-seller-id": "seller_1"
    };

    const orderResponse = await handlers.getOrder(
      buildRequest("/api/orders/order_1", { method: "GET", headers }),
      { orderId: "order_1" }
    );
    const paymentsResponse = await handlers.getOrderPayments(
      buildRequest("/api/orders/order_1/payments", { method: "GET", headers }),
      { orderId: "order_1" }
    );
    const fulfillmentResponse = await handlers.getOrderFulfillment(
      buildRequest("/api/orders/order_1/fulfillment", { method: "GET", headers }),
      { orderId: "order_1" }
    );
    const timelineResponse = await handlers.getOrderTimeline(
      buildRequest("/api/orders/order_1/timeline", { method: "GET", headers }),
      { orderId: "order_1" }
    );
    const webhooksResponse = await handlers.getOrderShippingWebhooks(
      buildRequest("/api/orders/order_1/shipping-webhooks", { method: "GET", headers }),
      { orderId: "order_1" }
    );

    expect(orderResponse.status).toBe(200);
    expect(paymentsResponse.status).toBe(200);
    expect(fulfillmentResponse.status).toBe(200);
    expect(timelineResponse.status).toBe(200);
    expect(webhooksResponse.status).toBe(200);
    expect(operatorQueryRepository.getOrderDetail).toHaveBeenCalledWith("order_1");
    expect(operatorQueryRepository.listPaymentAttempts).toHaveBeenCalledWith("order_1");
    expect(operatorQueryRepository.getFulfillment).toHaveBeenCalledWith("order_1");
    expect(operatorQueryRepository.listOrderTimeline).toHaveBeenCalledWith("order_1");
    expect(operatorQueryRepository.listShippingWebhookReceipts).toHaveBeenCalledWith("order_1");
    expect((await orderResponse.json()).order.id).toBe("order_1");
    expect((await paymentsResponse.json()).paymentAttempts).toHaveLength(1);
    expect((await fulfillmentResponse.json()).fulfillment.bookingReference).toBe("ship_1");
    expect((await timelineResponse.json()).timeline).toHaveLength(1);
    expect((await webhooksResponse.json()).receipts).toHaveLength(1);
  });

  it("returns notification visibility for scoped operators and supports list filters", async () => {
    const {
      handlers,
      notificationQueryRepository
    } = createHandlers();
    const response = await handlers.listNotifications(
      buildRequest("/api/notifications?status=sent&acknowledged=false", {
        method: "GET",
        headers: {
          authorization: "Bearer operator-secret",
          "x-sellora-seller-id": "seller_1"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(notificationQueryRepository.listNotifications).toHaveBeenCalledWith({
      sellerId: "seller_1",
      status: "sent",
      acknowledged: false
    });
    expect((await response.json()).notifications).toHaveLength(2);
  });

  it("returns notification detail and allows idempotent acknowledge within seller scope", async () => {
    const {
      handlers,
      notificationQueryRepository,
      acknowledgeNotificationService
    } = createHandlers();
    const headers = {
      authorization: "Bearer operator-secret",
      "x-sellora-seller-id": "seller_1"
    };

    const detailResponse = await handlers.getNotification(
      buildRequest("/api/notifications/notification_1", {
        method: "GET",
        headers
      }),
      { notificationId: "notification_1" }
    );
    const acknowledgeResponse = await handlers.acknowledgeNotification(
      buildRequest("/api/notifications/notification_1/acknowledge", {
        method: "POST",
        headers
      }),
      { notificationId: "notification_1" }
    );

    expect(detailResponse.status).toBe(200);
    expect(acknowledgeResponse.status).toBe(200);
    expect(notificationQueryRepository.getNotificationDetail).toHaveBeenCalledWith("notification_1");
    expect(acknowledgeNotificationService.execute).toHaveBeenCalledWith({
      notificationId: "notification_1",
      sellerId: "seller_1"
    });
    expect((await acknowledgeResponse.json()).notification.acknowledgedBySellerId).toBe("seller_1");
  });

  it("blocks notification reads and acknowledges outside seller scope", async () => {
    const {
      handlers,
      notificationQueryRepository,
      acknowledgeNotificationService
    } = createHandlers(new FakeHttpAccessRepository("seller_1", "seller_1", "seller_2"));
    const headers = {
      authorization: "Bearer operator-secret",
      "x-sellora-seller-id": "seller_1"
    };

    const detailResponse = await handlers.getNotification(
      buildRequest("/api/notifications/notification_1", {
        method: "GET",
        headers
      }),
      { notificationId: "notification_1" }
    );
    const acknowledgeResponse = await handlers.acknowledgeNotification(
      buildRequest("/api/notifications/notification_1/acknowledge", {
        method: "POST",
        headers
      }),
      { notificationId: "notification_1" }
    );

    expect(detailResponse.status).toBe(403);
    expect(acknowledgeResponse.status).toBe(403);
    expect(notificationQueryRepository.getNotificationDetail).not.toHaveBeenCalled();
    expect(acknowledgeNotificationService.execute).not.toHaveBeenCalled();
  });

  it("blocks query visibility for orders outside seller scope", async () => {
    const {
      handlers,
      operatorQueryRepository
    } = createHandlers(new FakeHttpAccessRepository("seller_2"));

    const response = await handlers.getOrder(
      buildRequest("/api/orders/order_1", {
        method: "GET",
        headers: {
          authorization: "Bearer operator-secret",
          "x-sellora-seller-id": "seller_1"
        }
      }),
      { orderId: "order_1" }
    );

    expect(response.status).toBe(403);
    expect(operatorQueryRepository.getOrderDetail).not.toHaveBeenCalled();
  });
});
