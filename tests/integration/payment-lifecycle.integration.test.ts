import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db/prisma.js";
import { MemoryEventBus } from "../../src/adapters/memory/memory-event-bus.js";
import { PrismaOrderLifecycleRepository } from "../../src/adapters/prisma/order-lifecycle.repository.js";
import { PrismaPaymentRepository } from "../../src/adapters/prisma/payment.repository.js";
import { TransitionOrderService } from "../../src/application/orders/transition-order.service.js";
import { PaymentService } from "../../src/application/payments/payment.service.js";

const describeIfDatabase = process.env.DATABASE_URL ? describe.sequential : describe.skip;

type FixtureOptions = {
  orderStatus: "pending_payment" | "reserved" | "packing";
  paymentStatus: "pending" | "processing";
  paymentPolicy?: "full-upfront";
  reserveInventory?: boolean;
};

type TestFixture = {
  sellerId: string;
  orderId: string;
  paymentAttemptId: string;
  paymentProvider: string;
  paymentAmountMinor: number;
};

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${Date.now()}_${sequence}`;
}

async function cleanupDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "OrderEvent",
      "PaymentAttempt",
      "FulfillmentRecord",
      "InventoryMovement",
      "OrderLine",
      "Order",
      "ProductOffering",
      "ProductMedia",
      "ProductInspection",
      "Product",
      "Customer",
      "StorefrontSettings",
      "StaffMembership",
      "SellerAutonomyPolicy",
      "WorkflowRun",
      "AutonomousActionLog",
      "ImportJob",
      "Opportunity",
      "SourceListing",
      "SupplierSource",
      "QuoteLine",
      "Quote",
      "Invoice",
      "ConversationMessage",
      "ConversationThread",
      "WarrantyPolicy",
      "VerificationTemplate",
      "Seller",
      "User",
      "CategoryTemplate"
    RESTART IDENTITY CASCADE
  `);
}

async function createFixture(options: FixtureOptions): Promise<TestFixture> {
  const user = await prisma.user.create({
    data: {
      email: `${nextId("owner")}@sellora.test`,
      fullName: "Sellora Test Owner",
      passwordHash: "hashed"
    }
  });

  const seller = await prisma.seller.create({
    data: {
      ownerUserId: user.id,
      slug: nextId("seller"),
      displayName: "Sellora Test Seller"
    }
  });

  const customer = await prisma.customer.create({
    data: {
      sellerId: seller.id,
      name: "Test Customer",
      phone: nextId("phone")
    }
  });

  const categoryTemplate = await prisma.categoryTemplate.create({
    data: {
      key: nextId("phones"),
      displayName: "Phones",
      productFieldsJson: [],
      verificationJson: []
    }
  });

  const product = await prisma.product.create({
    data: {
      sellerId: seller.id,
      categoryTemplateId: categoryTemplate.id,
      slug: nextId("product"),
      title: "Test Device",
      status: "ACTIVE",
      attributesJson: {}
    }
  });

  const offering = await prisma.productOffering.create({
    data: {
      sellerId: seller.id,
      productId: product.id,
      sku: nextId("sku"),
      inventoryMode: "STOCKED",
      currency: "AED",
      priceMinor: 10000,
      costPriceMinor: 7000,
      isActive: true,
      selectedAttributesJson: {}
    }
  });

  if (options.reserveInventory) {
    await prisma.inventoryMovement.create({
      data: {
        sellerId: seller.id,
        productOfferingId: offering.id,
        type: "RESERVE",
        quantity: 1,
        referenceType: "order_seed",
        referenceId: "seed"
      }
    });
  }

  const order = await prisma.order.create({
    data: {
      sellerId: seller.id,
      customerId: customer.id,
      orderNumber: nextId("SOR"),
      mode: "STANDARD",
      status: options.orderStatus.toUpperCase() as "PENDING_PAYMENT" | "RESERVED" | "PACKING",
      paymentPolicy: "FULL_UPFRONT",
      paymentStatus: options.paymentStatus.toUpperCase() as "PENDING" | "PROCESSING",
      subtotalMinor: 10000,
      totalMinor: 10000,
      currency: "AED",
      lines: {
        create: {
          productId: product.id,
          productOfferingId: offering.id,
          titleSnapshot: "Test Device",
          quantity: 1,
          unitPriceMinor: 10000,
          costPriceMinor: 7000,
          currencySnapshot: "AED",
          selectedAttributesSnapshot: {},
          lineTotalMinor: 10000
        }
      }
    }
  });

  const paymentAttempt = await prisma.paymentAttempt.create({
    data: {
      sellerId: seller.id,
      orderId: order.id,
      provider: "stripe",
      amountMinor: 10000,
      currency: "AED",
      status: options.paymentStatus.toUpperCase() as "PENDING" | "PROCESSING"
    }
  });

  return {
    sellerId: seller.id,
    orderId: order.id,
    paymentAttemptId: paymentAttempt.id,
    paymentProvider: paymentAttempt.provider,
    paymentAmountMinor: paymentAttempt.amountMinor
  };
}

function createIntegratedServices() {
  const eventBus = new MemoryEventBus();
  const transitionOrderService = new TransitionOrderService(
    new PrismaOrderLifecycleRepository(),
    eventBus
  );
  const paymentService = new PaymentService(
    new PrismaPaymentRepository(),
    transitionOrderService,
    undefined,
    eventBus
  );

  return { eventBus, paymentService };
}

describeIfDatabase("Payment lifecycle DB integration", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  it(
    "commits payment success once and couples lifecycle transition exactly once",
    async () => {
    const fixture = await createFixture({
      orderStatus: "pending_payment",
      paymentStatus: "pending"
    });
    const { paymentService, eventBus } = createIntegratedServices();

    await paymentService.markSucceeded({
      paymentAttemptId: fixture.paymentAttemptId,
      provider: fixture.paymentProvider,
      providerReference: "pi_success_1"
    });

    const paymentAttempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: fixture.paymentAttemptId }
    });
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: fixture.orderId }
    });
    const events = await prisma.orderEvent.findMany({
      where: { orderId: fixture.orderId },
      orderBy: { createdAt: "asc" }
    });

    expect(paymentAttempt.status).toBe("PAID");
    expect(paymentAttempt.providerReference).toBe("pi_success_1");
    expect(order.status).toBe("CONFIRMED");
    expect(order.paymentStatus).toBe("PAID");
    expect(events.filter((event) => event.eventType === "payment_succeeded")).toHaveLength(1);
    expect(events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
    expect(eventBus.events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
    },
    30000
  );

  it(
    "treats duplicate success callback as idempotent under the database",
    async () => {
    const fixture = await createFixture({
      orderStatus: "pending_payment",
      paymentStatus: "pending"
    });
    const { paymentService, eventBus } = createIntegratedServices();

    await paymentService.markSucceeded({
      paymentAttemptId: fixture.paymentAttemptId,
      provider: fixture.paymentProvider,
      providerReference: "pi_duplicate_1"
    });

    await paymentService.markSucceeded({
      paymentAttemptId: fixture.paymentAttemptId,
      provider: fixture.paymentProvider,
      providerReference: "pi_duplicate_1"
    });

    const events = await prisma.orderEvent.findMany({
      where: { orderId: fixture.orderId }
    });

    expect(events.filter((event) => event.eventType === "payment_succeeded")).toHaveLength(1);
    expect(events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
    expect(eventBus.events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
    },
    30000
  );

  it(
    "records payment success without regressing an already-advanced order",
    async () => {
    const fixture = await createFixture({
      orderStatus: "packing",
      paymentStatus: "processing"
    });
    const { paymentService, eventBus } = createIntegratedServices();

    await paymentService.markSucceeded({
      paymentAttemptId: fixture.paymentAttemptId,
      provider: fixture.paymentProvider,
      providerReference: "pi_advanced_1"
    });

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: fixture.orderId }
    });
    const events = await prisma.orderEvent.findMany({
      where: { orderId: fixture.orderId }
    });

    expect(order.status).toBe("PACKING");
    expect(order.paymentStatus).toBe("PAID");
    expect(events.filter((event) => event.eventType === "payment_succeeded")).toHaveLength(1);
    expect(events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(0);
    expect(eventBus.events).toHaveLength(0);
    },
    30000
  );

  it(
    "fails payment without mutating inventory or lifecycle state",
    async () => {
    const fixture = await createFixture({
      orderStatus: "reserved",
      paymentStatus: "processing",
      reserveInventory: true
    });
    const { paymentService } = createIntegratedServices();
    const inventoryBefore = await prisma.inventoryMovement.count();

    await paymentService.markFailed({
      paymentAttemptId: fixture.paymentAttemptId,
      reason: "provider_error"
    });

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: fixture.orderId }
    });
    const paymentAttempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: fixture.paymentAttemptId }
    });
    const inventoryAfter = await prisma.inventoryMovement.count();
    const events = await prisma.orderEvent.findMany({
      where: { orderId: fixture.orderId }
    });

    expect(order.status).toBe("RESERVED");
    expect(order.paymentStatus).toBe("FAILED");
    expect(paymentAttempt.status).toBe("FAILED");
    expect(inventoryAfter).toBe(inventoryBefore);
    expect(events.filter((event) => event.eventType === "payment_failed")).toHaveLength(1);
    expect(events.filter((event) => event.eventType.startsWith("inventory_"))).toHaveLength(0);
    expect(events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(0);
    },
    30000
  );

  it(
    "rolls back payment truth if lifecycle transition fails inside the transaction",
    async () => {
    const fixture = await createFixture({
      orderStatus: "pending_payment",
      paymentStatus: "pending"
    });
    const paymentRepository = new PrismaPaymentRepository();
    const failingTransitionOrderService = {
      async transition() {
        throw new Error("forced lifecycle failure");
      }
    };
    const paymentService = new PaymentService(paymentRepository, failingTransitionOrderService);

    await expect(
      paymentService.markSucceeded({
        paymentAttemptId: fixture.paymentAttemptId,
        provider: fixture.paymentProvider,
        providerReference: "pi_rollback_1"
      })
    ).rejects.toThrow("forced lifecycle failure");

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: fixture.orderId }
    });
    const paymentAttempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: fixture.paymentAttemptId }
    });
    const events = await prisma.orderEvent.findMany({
      where: { orderId: fixture.orderId }
    });

    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.paymentStatus).toBe("PENDING");
    expect(paymentAttempt.status).toBe("PENDING");
    expect(paymentAttempt.providerReference).toBeNull();
    expect(events.filter((event) => event.eventType === "payment_succeeded")).toHaveLength(0);
    expect(events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(0);
    },
    30000
  );
});
