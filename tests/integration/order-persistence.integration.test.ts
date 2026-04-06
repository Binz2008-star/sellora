import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db/prisma.js";
import { MemoryEventBus } from "../../src/adapters/memory/memory-event-bus.js";
import { PrismaOrderCheckoutRepository } from "../../src/adapters/prisma/order-checkout.repository.js";
import { PrismaOrderLifecycleRepository } from "../../src/adapters/prisma/order-lifecycle.repository.js";
import { CreateOrderService } from "../../src/application/orders/create-order.service.js";
import { TransitionOrderService } from "../../src/application/orders/transition-order.service.js";
import { deriveInventoryPosition } from "../../src/modules/orders/inventory-ledger.js";

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
      "ShippingWebhookReceipt",
      "NotificationLog",
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

async function createCatalogFixture(quantityOnHand: number) {
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
      title: "Atomic Test Device",
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

  if (quantityOnHand > 0) {
    await prisma.inventoryMovement.create({
      data: {
        sellerId: seller.id,
        productOfferingId: offering.id,
        type: "RECEIVE",
        quantity: quantityOnHand,
        referenceType: "seed",
        referenceId: "initial_stock"
      }
    });
  }

  return {
    sellerId: seller.id,
    productOfferingId: offering.id
  };
}

describe.sequential("Order persistence DB integration", () => {
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

  it("persists order, lines, reserve movements, and one order_created event atomically", async () => {
    const fixture = await createCatalogFixture(3);
    const eventBus = new MemoryEventBus();
    const service = new CreateOrderService(new PrismaOrderCheckoutRepository(), eventBus);

    const result = await service.create({
      sellerId: fixture.sellerId,
      mode: "standard",
      paymentPolicy: "full-upfront",
      customer: {
        name: "Atomic Customer",
        phone: nextId("phone"),
        city: "Dubai"
      },
      lines: [{
        productOfferingId: fixture.productOfferingId,
        quantity: 1
      }]
    });

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.order.id },
      include: { lines: true, events: true }
    });
    const movements = await prisma.inventoryMovement.findMany({
      where: {
        referenceType: "order",
        referenceId: order.id
      }
    });

    expect(order.lines).toHaveLength(1);
    expect(movements.filter((movement) => movement.type === "RESERVE")).toHaveLength(1);
    expect(order.events.filter((event) => event.eventType === "order_created")).toHaveLength(1);
    expect(order.events.filter((event) => event.eventType === "inventory_reserved")).toHaveLength(1);
    expect(eventBus.events.filter((event) => event.eventType === "order_created")).toHaveLength(1);
  }, 30000);

  it("rolls back order creation fully when inventory is insufficient", async () => {
    const fixture = await createCatalogFixture(0);
    const service = new CreateOrderService(
      new PrismaOrderCheckoutRepository(),
      new MemoryEventBus()
    );

    await expect(
      service.create({
        sellerId: fixture.sellerId,
        mode: "standard",
        paymentPolicy: "full-upfront",
        customer: {
          name: "Rejected Customer",
          phone: nextId("phone"),
          city: "Dubai"
        },
        lines: [{
          productOfferingId: fixture.productOfferingId,
          quantity: 1
        }]
      })
    ).rejects.toThrow("Insufficient inventory");

    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderLine.count()).toBe(0);
    expect(
      await prisma.inventoryMovement.count({
        where: {
          referenceType: "order"
        }
      })
    ).toBe(0);
    expect(await prisma.orderEvent.count()).toBe(0);
  }, 30000);

  it("releases reserved inventory and writes cancellation event exactly once", async () => {
    const fixture = await createCatalogFixture(1);
    const createOrderService = new CreateOrderService(
      new PrismaOrderCheckoutRepository(),
      new MemoryEventBus()
    );
    const created = await createOrderService.create({
      sellerId: fixture.sellerId,
      mode: "standard",
      paymentPolicy: "full-upfront",
      customer: {
        name: "Cancellation Customer",
        phone: nextId("phone"),
        city: "Dubai"
      },
      lines: [{
        productOfferingId: fixture.productOfferingId,
        quantity: 1
      }]
    });

    const transitionService = new TransitionOrderService(
      new PrismaOrderLifecycleRepository(),
      new MemoryEventBus()
    );

    await transitionService.transition({
      orderId: created.order.id,
      nextStatus: "cancelled",
      reason: "customer_request"
    });

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: created.order.id }
    });
    const events = await prisma.orderEvent.findMany({
      where: { orderId: created.order.id }
    });
    const movements = await prisma.inventoryMovement.findMany({
      where: { productOfferingId: fixture.productOfferingId },
      orderBy: { createdAt: "asc" }
    });
    const position = deriveInventoryPosition(
      movements.map((movement) => ({
        id: movement.id,
        sellerId: movement.sellerId,
        productOfferingId: movement.productOfferingId,
        type: movement.type.toLowerCase() as "receive" | "reserve" | "release" | "deduct" | "adjust" | "return",
        quantity: movement.quantity,
        referenceType: movement.referenceType ?? undefined,
        referenceId: movement.referenceId ?? undefined,
        notes: movement.notes ?? undefined,
        occurredAt: movement.occurredAt.toISOString(),
        createdAt: movement.createdAt.toISOString(),
        updatedAt: movement.updatedAt.toISOString()
      }))
    );

    expect(order.status).toBe("CANCELLED");
    expect(events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
    expect(events.filter((event) => event.eventType === "inventory_released")).toHaveLength(1);
    expect(position.available).toBe(1);
  }, 30000);

  it("prevents oversell under concurrent order creation and keeps order numbers unique", async () => {
    const fixture = await createCatalogFixture(1);
    const eventBus = new MemoryEventBus();
    const service = new CreateOrderService(new PrismaOrderCheckoutRepository(), eventBus);
    const input = {
      sellerId: fixture.sellerId,
      mode: "standard" as const,
      paymentPolicy: "full-upfront" as const,
      customer: {
        name: "Concurrent Customer",
        phone: nextId("phone"),
        city: "Dubai"
      },
      lines: [{
        productOfferingId: fixture.productOfferingId,
        quantity: 1
      }]
    };

    const outcomes = await Promise.allSettled([
      service.create(input),
      service.create({
        ...input,
        customer: {
          ...input.customer,
          phone: nextId("phone")
        }
      })
    ]);

    const fulfilled = outcomes.filter(
      (outcome): outcome is PromiseFulfilledResult<Awaited<ReturnType<CreateOrderService["create"]>>> =>
        outcome.status === "fulfilled"
    );
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.reason)).toMatch(/Insufficient inventory|could not serialize|transaction/i);

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "asc" }
    });
    const movements = await prisma.inventoryMovement.findMany({
      where: { productOfferingId: fixture.productOfferingId }
    });
    const position = deriveInventoryPosition(
      movements.map((movement) => ({
        id: movement.id,
        sellerId: movement.sellerId,
        productOfferingId: movement.productOfferingId,
        type: movement.type.toLowerCase() as "receive" | "reserve" | "release" | "deduct" | "adjust" | "return",
        quantity: movement.quantity,
        referenceType: movement.referenceType ?? undefined,
        referenceId: movement.referenceId ?? undefined,
        notes: movement.notes ?? undefined,
        occurredAt: movement.occurredAt.toISOString(),
        createdAt: movement.createdAt.toISOString(),
        updatedAt: movement.updatedAt.toISOString()
      }))
    );

    expect(orders).toHaveLength(1);
    expect(new Set(orders.map((order) => order.orderNumber)).size).toBe(1);
    expect(position.available).toBeGreaterThanOrEqual(0);
    expect(position.reserved).toBe(1);
  }, 30000);
});
