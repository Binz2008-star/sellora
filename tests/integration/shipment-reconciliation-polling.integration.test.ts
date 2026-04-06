import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db/prisma.js";
import { MemoryEventBus } from "../../src/adapters/memory/memory-event-bus.js";
import { PrismaFulfillmentRepository } from "../../src/adapters/prisma/fulfillment.repository.js";
import { PrismaShippingWebhookRepository } from "../../src/adapters/prisma/shipping-webhook.repository.js";
import { PrismaOrderLifecycleRepository } from "../../src/adapters/prisma/order-lifecycle.repository.js";
import { PrismaShipmentReconciliationPollingRepository } from "../../src/adapters/prisma/shipment-reconciliation-polling.repository.js";
import { ConfirmOrderDeliveryService } from "../../src/application/orders/confirm-order-delivery.service.js";
import { TransitionOrderService } from "../../src/application/orders/transition-order.service.js";
import { HandleShippingWebhookService } from "../../src/application/fulfillment/handle-shipping-webhook.service.js";
import { ReconcileShipmentStatusService } from "../../src/application/fulfillment/reconcile-shipment-status.service.js";
import { RunShipmentReconciliationPollingService } from "../../src/application/fulfillment/run-shipment-reconciliation-polling.service.js";
import type {
  ShipmentBookingRequest,
  ShipmentBookingResult,
  ShipmentStatusRequest,
  ShipmentStatusResult,
  ShippingGateway
} from "../../src/ports/shipping-gateway.js";

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

async function createFixture(
  orderStatus: "SHIPPED" | "DELIVERED",
  fulfillmentStatus: "SHIPPED" | "DELIVERED",
  providerStatus: string | null,
  lastWebhookAt?: string
) {
  const user = await prisma.user.create({
    data: {
      email: `${nextId("owner")}@sellora.test`,
      fullName: "Polling Owner",
      passwordHash: "hashed"
    }
  });

  const seller = await prisma.seller.create({
    data: {
      ownerUserId: user.id,
      slug: nextId("seller"),
      displayName: "Polling Seller"
    }
  });

  const customer = await prisma.customer.create({
    data: {
      sellerId: seller.id,
      name: "Polling Customer",
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
      title: "Polling Device",
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
      status: orderStatus,
      paymentPolicy: "FULL_UPFRONT",
      paymentStatus: "PAID",
      subtotalMinor: 10000,
      totalMinor: 10000,
      currency: "AED",
      lines: {
        create: {
          productId: product.id,
          productOfferingId: offering.id,
          titleSnapshot: "Polling Device",
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
      status: fulfillmentStatus,
      bookingReference: `ship_ref_${order.id}`,
      courierName: "karrio",
      trackingNumber: `TRK-${order.id}`,
      providerStatus,
      ...(lastWebhookAt ? { lastWebhookAt: new Date(lastWebhookAt) } : {})
    }
  });

  return { orderId: order.id };
}

class FakeShippingGateway implements ShippingGateway {
  statusCalls: ShipmentStatusRequest[] = [];

  async bookShipment(_request: ShipmentBookingRequest): Promise<ShipmentBookingResult> {
    throw new Error("not used");
  }

  async getShipmentStatus(request: ShipmentStatusRequest): Promise<ShipmentStatusResult> {
    this.statusCalls.push(request);
    return {
      success: true,
      provider: "karrio",
      providerReference: request.bookingReference,
      trackingNumber: request.trackingNumber,
      normalizedStatus: "delivered",
      observedAt: "2026-04-06T00:00:00.000Z",
      rawPayload: {
        status: "delivered"
      }
    };
  }
}

function createPollingServices(shippingGateway: ShippingGateway) {
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
  const handleShippingWebhookService = new HandleShippingWebhookService(
    new PrismaShippingWebhookRepository(),
    fulfillmentRepository,
    confirmOrderDeliveryService,
    eventBus
  );
  const reconcileService = new ReconcileShipmentStatusService(
    fulfillmentRepository,
    shippingGateway,
    handleShippingWebhookService
  );
  const pollingService = new RunShipmentReconciliationPollingService(
    new PrismaShipmentReconciliationPollingRepository(),
    reconcileService
  );

  return { eventBus, pollingService };
}

describe.sequential("Shipment reconciliation polling DB integration", () => {
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
    "selects only eligible non-terminal shipped records and recovers them through polling",
    async () => {
      const eligible = await createFixture("SHIPPED", "SHIPPED", "in_transit");
      await createFixture("DELIVERED", "DELIVERED", "delivered");
      await createFixture("SHIPPED", "SHIPPED", "delivered");
      await createFixture("SHIPPED", "SHIPPED", null, "2026-04-06T11:55:00.000Z");
      const gateway = new FakeShippingGateway();
      const { pollingService } = createPollingServices(gateway);

      const result = await pollingService.execute({
        batchSize: 10,
        lookbackDays: 3,
        minWebhookAgeMinutes: 30,
        now: "2026-04-06T12:00:00.000Z"
      });

      const eligibleOrder = await prisma.order.findUniqueOrThrow({
        where: { id: eligible.orderId }
      });

      expect(result.scanned).toBe(1);
      expect(result.failures).toBe(0);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].orderId).toBe(eligible.orderId);
      expect(gateway.statusCalls).toHaveLength(1);
      expect(eligibleOrder.status).toBe("DELIVERED");
    },
    30000
  );
});
