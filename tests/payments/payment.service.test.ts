import { beforeEach, describe, expect, it } from "vitest";
import { PaymentService } from "../../src/application/payments/payment.service.js";
import type { Order } from "../../src/domain/orders/order.js";
import type {
  PaymentAttempt,
  PaymentEventType
} from "../../src/domain/payments/payment.js";
import type {
  CreatePaymentAttemptInput,
  PaymentAttemptContext,
  PaymentRepository,
  UpdatePaymentAttemptStatusInput
} from "../../src/ports/payment-repository.js";

function makeOrder(status: Order["status"]): Order {
  return {
    id: "order_1",
    sellerId: "seller_1",
    customerId: "customer_1",
    orderNumber: "SOR-PAY-1",
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

function makeAttempt(
  status: PaymentAttempt["status"],
  overrides: Partial<PaymentAttempt> = {}
): PaymentAttempt {
  return {
    id: "payment_1",
    sellerId: "seller_1",
    orderId: "order_1",
    provider: "stripe",
    status,
    amount: { amountMinor: 10000, currency: "AED" },
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides
  };
}

class FakePaymentRepository implements PaymentRepository {
  context: PaymentAttemptContext;
  createdAttempts: CreatePaymentAttemptInput[] = [];
  statusUpdates: UpdatePaymentAttemptStatusInput[] = [];
  paymentEvents: PaymentEventType[] = [];

  constructor(context: PaymentAttemptContext) {
    this.context = context;
  }

  async withTransaction<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }

  async findAttemptContextById(paymentAttemptId: string): Promise<PaymentAttemptContext | null> {
    return this.context.attempt.id === paymentAttemptId ? this.context : null;
  }

  async findAttemptContextByIdempotencyKey(
    sellerId: string,
    idempotencyKey: string
  ): Promise<PaymentAttemptContext | null> {
    if (
      this.context.attempt.sellerId === sellerId &&
      this.context.attempt.idempotencyKey === idempotencyKey
    ) {
      return this.context;
    }

    return null;
  }

  async findAttemptContextByProviderReference(
    provider: string,
    providerReference: string
  ): Promise<PaymentAttemptContext | null> {
    if (
      this.context.attempt.provider === provider &&
      this.context.attempt.providerReference === providerReference
    ) {
      return this.context;
    }

    return null;
  }

  async findActiveAttemptForOrder(orderId: string): Promise<PaymentAttemptContext | null> {
    if (
      this.context.order.id === orderId &&
      (this.context.attempt.status === "pending" || this.context.attempt.status === "processing")
    ) {
      return this.context;
    }

    return null;
  }

  async createAttempt(input: CreatePaymentAttemptInput): Promise<PaymentAttemptContext> {
    this.createdAttempts.push(input);
    this.paymentEvents.push("payment_initiated");

    this.context = {
      order: this.context.order,
      attempt: makeAttempt("pending", {
        id: "payment_created",
        sellerId: input.sellerId,
        orderId: input.orderId,
        provider: input.provider,
        idempotencyKey: input.idempotencyKey,
        amount: {
          amountMinor: input.amountMinor,
          currency: input.currency
        }
      })
    };

    return this.context;
  }

  async updateAttemptStatus(input: UpdatePaymentAttemptStatusInput): Promise<PaymentAttemptContext> {
    this.statusUpdates.push(input);
    this.paymentEvents.push(input.eventType);

    const now = new Date().toISOString();
    this.context = {
      order: {
        ...this.context.order,
        paymentStatus: input.nextStatus,
        updatedAt: now
      },
      attempt: {
        ...this.context.attempt,
        status: input.nextStatus,
        providerReference: input.providerReference ?? this.context.attempt.providerReference,
        metadata: input.metadata,
        rawPayload: input.rawPayload,
        updatedAt: now
      }
    };

    return this.context;
  }
}

class FakeTransitionOrderService {
  calls: Array<{ orderId: string; nextStatus: Order["status"]; reason?: string }> = [];

  async transition(input: { orderId: string; nextStatus: Order["status"]; reason?: string }) {
    this.calls.push(input);
    return {
      pendingExternalEvents: []
    };
  }
}

function createHarness(
  orderStatus: Order["status"],
  paymentStatus: PaymentAttempt["status"] = "pending",
  paymentOverrides: Partial<PaymentAttempt> = {}
) {
  const repository = new FakePaymentRepository({
    order: makeOrder(orderStatus),
    attempt: makeAttempt(paymentStatus, paymentOverrides)
  });
  const lifecycle = new FakeTransitionOrderService();
  const service = new PaymentService(repository, lifecycle);

  return { repository, lifecycle, service };
}

describe("PaymentService transitions", () => {
  it("initiates a payment attempt once and supports idempotency key reuse", async () => {
    const { service, repository } = createHarness("pending_payment", "failed", {
      id: "payment_existing",
      idempotencyKey: "idem_1"
    });

    const result = await service.initiatePaymentAttempt({
      sellerId: "seller_1",
      orderId: "order_1",
      provider: "stripe",
      amountMinor: 10000,
      currency: "AED",
      idempotencyKey: "idem_1"
    });

    expect(result.attempt.id).toBe("payment_existing");
    expect(repository.createdAttempts).toHaveLength(0);
  });

  it("marks pending payment as processing", async () => {
    const { service, repository } = createHarness("pending_payment", "pending");

    const result = await service.markProcessing({
      paymentAttemptId: "payment_1"
    });

    expect(result.attempt.status).toBe("processing");
    expect(repository.paymentEvents).toContain("payment_processing");
  });

  it("marks pending payment as succeeded and requests exactly one lifecycle transition", async () => {
    const { service, repository, lifecycle } = createHarness("pending_payment", "pending");

    const result = await service.markSucceeded({
      paymentAttemptId: "payment_1",
      provider: "stripe",
      providerReference: "pi_123"
    });

    expect(result.attempt.status).toBe("paid");
    expect(lifecycle.calls).toHaveLength(1);
    expect(lifecycle.calls[0]).toEqual({
      orderId: "order_1",
      nextStatus: "confirmed",
      reason: "payment_succeeded"
    });
    expect(repository.paymentEvents.filter((event) => event === "payment_succeeded")).toHaveLength(1);
  });

  it("marks pending payment as failed without invoking lifecycle", async () => {
    const { service, repository, lifecycle } = createHarness("pending_payment", "pending");

    const result = await service.markFailed({
      paymentAttemptId: "payment_1",
      reason: "card_declined"
    });

    expect(result.attempt.status).toBe("failed");
    expect(lifecycle.calls).toHaveLength(0);
    expect(repository.paymentEvents.filter((event) => event === "payment_failed")).toHaveLength(1);
  });
});

describe("PaymentService blocked transitions and idempotency", () => {
  it("blocks paid -> processing", async () => {
    const { service, repository, lifecycle } = createHarness("confirmed", "paid", {
      providerReference: "pi_123"
    });

    await expect(
      service.markProcessing({
        paymentAttemptId: "payment_1"
      })
    ).rejects.toThrow("Invalid payment transition");

    expect(repository.statusUpdates).toHaveLength(0);
    expect(lifecycle.calls).toHaveLength(0);
  });

  it("blocks failed -> processing", async () => {
    const { service, repository, lifecycle } = createHarness("pending_payment", "failed");

    await expect(
      service.markProcessing({
        paymentAttemptId: "payment_1"
      })
    ).rejects.toThrow("Invalid payment transition");

    expect(repository.statusUpdates).toHaveLength(0);
    expect(lifecycle.calls).toHaveLength(0);
  });

  it("treats duplicate success callback as idempotent with no duplicate effects", async () => {
    const { service, repository, lifecycle } = createHarness("confirmed", "paid", {
      providerReference: "pi_dup"
    });

    const result = await service.markSucceeded({
      paymentAttemptId: "payment_1",
      provider: "stripe",
      providerReference: "pi_dup"
    });

    expect(result.attempt.status).toBe("paid");
    expect(repository.statusUpdates).toHaveLength(0);
    expect(repository.paymentEvents.filter((event) => event === "payment_succeeded")).toHaveLength(0);
    expect(lifecycle.calls).toHaveLength(0);
  });

  it("success on advanced order state does not regress lifecycle", async () => {
    const { service, repository, lifecycle } = createHarness("packing", "processing");

    const result = await service.markSucceeded({
      paymentAttemptId: "payment_1",
      provider: "stripe",
      providerReference: "pi_advanced"
    });

    expect(result.attempt.status).toBe("paid");
    expect(lifecycle.calls).toHaveLength(0);
    expect(repository.paymentEvents.filter((event) => event === "payment_succeeded")).toHaveLength(1);
  });
});

describe("PaymentService isolation guarantees", () => {
  it("failed payment does not mutate inventory and only writes payment truth", async () => {
    const { service, lifecycle } = createHarness("reserved", "processing");

    await service.markFailed({
      paymentAttemptId: "payment_1",
      reason: "network_error"
    });

    expect(lifecycle.calls).toHaveLength(0);
  });

  it("payment events stay single-write per transition", async () => {
    const { service, repository } = createHarness("pending_payment", "pending");

    await service.markProcessing({
      paymentAttemptId: "payment_1"
    });

    expect(repository.paymentEvents.filter((event) => event === "payment_processing")).toHaveLength(1);
  });
});
