import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db/prisma.js";
import { MemoryEventBus } from "../../src/adapters/memory/memory-event-bus.js";
import { PrismaFulfillmentRepository } from "../../src/adapters/prisma/fulfillment.repository.js";
import { PrismaShippingWebhookRepository } from "../../src/adapters/prisma/shipping-webhook.repository.js";
import { PrismaOrderLifecycleRepository } from "../../src/adapters/prisma/order-lifecycle.repository.js";
import { ConfirmOrderDeliveryService } from "../../src/application/orders/confirm-order-delivery.service.js";
import { TransitionOrderService } from "../../src/application/orders/transition-order.service.js";
import { HandleShippingWebhookService } from "../../src/application/fulfillment/handle-shipping-webhook.service.js";
import { createIdempotencyKey } from "../../src/modules/events/idempotency.js";

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${Date.now()}_${sequence}`;
}

async function cleanupDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ShippingWebhookReceipt",
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

async function createShippedFixture() {
  const user = await prisma.user.create({
    data: {
      email: `${nextId("owner")}@sellora.test`,
      fullName: "Webhook Owner",
      passwordHash: "hashed"
    }
  });

  const seller = await prisma.seller.create({
    data: {
      ownerUserId: user.id,
      slug: nextId("seller"),
      displayName: "Webhook Seller"
    }
  });

  const customer = await prisma.customer.create({
    data: {
      sellerId: seller.id,
      name: "Webhook Customer",
      phone: nextId("phone"),
      city: "Dubai"
    }
  });

  const categoryTemplate = await prisma.categoryTemplate.create({
    data: {
      key: nextId("devices"),
      displayName: "Devices",
      productFieldsJson: [],
      verificationJson: []
    }
  });

  const product = await prisma.product.create({
    data: {
      sellerId: seller.id,
      categoryTemplateId: categoryTemplate.id,
      slug: nextId("product"),
      title: "Webhook Device",
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

  const order = await prisma.order.create({
    data: {
      sellerId: seller.id,
      customerId: customer.id,
      orderNumber: nextId("SOR"),
      mode: "STANDARD",
      status: "SHIPPED",
      paymentPolicy: "FULL_UPFRONT",
      paymentStatus: "PAID",
      subtotalMinor: 10000,
      totalMinor: 10000,
      currency: "AED",
      lines: {
        create: {
          productId: product.id,
          productOfferingId: offering.id,
          titleSnapshot: "Webhook Device",
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

  await prisma.fulfillmentRecord.create({
    data: {
      sellerId: seller.id,
      orderId: order.id,
      status: "SHIPPED",
      bookingReference: "ship_ref_1",
      courierName: "karrio",
      trackingNumber: "TRK-1"
    }
  });

  return {
    orderId: order.id
  };
}

function createWebhookServices() {
  const eventBus = new MemoryEventBus();
  const fulfillmentRepository = new PrismaFulfillmentRepository();
  const transitionOrderService = new TransitionOrderService(
    new PrismaOrderLifecycleRepository(),
    eventBus
  );
  const confirmOrderDeliveryService = new ConfirmOrderDeliveryService(
    fulfillmentRepository,
    transitionOrderService
  );
  const service = new HandleShippingWebhookService(
    new PrismaShippingWebhookRepository(),
    fulfillmentRepository,
    confirmOrderDeliveryService,
    eventBus
  );

  return { eventBus, service };
}

describe.sequential("Shipping webhook DB integration", () => {
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
    "persists raw payload and hands delivered webhook to authority once",
    async () => {
      const fixture = await createShippedFixture();
      const { eventBus, service } = createWebhookServices();
      const webhook = {
        provider: "karrio" as const,
        eventType: "tracker.updated",
        idempotencyKey: createIdempotencyKey(["karrio", "ship_ref_1", "delivered", "evt1"]),
        providerReference: "ship_ref_1",
        trackingNumber: "TRK-1",
        normalizedStatus: "delivered",
        rawPayload: {
          type: "tracker.updated",
          data: {
            id: "ship_ref_1",
            tracking_number: "TRK-1",
            status: "delivered"
          }
        },
        receivedAt: "2026-04-06T00:00:00.000Z"
      };

      const result = await service.execute(webhook);

      const order = await prisma.order.findUniqueOrThrow({ where: { id: fixture.orderId } });
      const fulfillment = await prisma.fulfillmentRecord.findUniqueOrThrow({
        where: { orderId: fixture.orderId }
      });
      const receipts = await prisma.shippingWebhookReceipt.findMany();

      expect(result.duplicate).toBe(false);
      expect(result.deliveredHandoff).toBe(true);
      expect(order.status).toBe("DELIVERED");
      expect(fulfillment.providerStatus).toBe("delivered");
      expect(fulfillment.rawPayloadJson).toEqual(webhook.rawPayload);
      expect(receipts).toHaveLength(1);
      expect(eventBus.events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
      expect(eventBus.events.filter((event) => event.eventType === "fulfillment_status_changed")).toHaveLength(1);
    },
    30000
  );

  it(
    "protects against duplicate webhook delivery",
    async () => {
      await createShippedFixture();
      const { service } = createWebhookServices();
      const webhook = {
        provider: "karrio" as const,
        eventType: "tracker.updated",
        idempotencyKey: createIdempotencyKey(["karrio", "ship_ref_1", "delivered", "evt1"]),
        providerReference: "ship_ref_1",
        trackingNumber: "TRK-1",
        normalizedStatus: "delivered",
        rawPayload: {
          type: "tracker.updated"
        },
        receivedAt: "2026-04-06T00:00:00.000Z"
      };

      await service.execute(webhook);
      const second = await service.execute(webhook);

      const receipts = await prisma.shippingWebhookReceipt.findMany();
      const orderEvents = await prisma.orderEvent.findMany({
        where: {
          eventType: "order_status_changed"
        }
      });

      expect(second.duplicate).toBe(true);
      expect(receipts).toHaveLength(1);
      expect(orderEvents).toHaveLength(1);
    },
    30000
  );
});
