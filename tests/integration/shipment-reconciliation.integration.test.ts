import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db/prisma.js";
import { MemoryEventBus } from "../../src/adapters/memory/memory-event-bus.js";
import { PrismaFulfillmentRepository } from "../../src/adapters/prisma/fulfillment.repository.js";
import { PrismaShippingWebhookRepository } from "../../src/adapters/prisma/shipping-webhook.repository.js";
import { PrismaOrderLifecycleRepository } from "../../src/adapters/prisma/order-lifecycle.repository.js";
import { ConfirmOrderDeliveryService } from "../../src/application/orders/confirm-order-delivery.service.js";
import { TransitionOrderService } from "../../src/application/orders/transition-order.service.js";
import { HandleShippingWebhookService } from "../../src/application/fulfillment/handle-shipping-webhook.service.js";
import { ReconcileShipmentStatusService } from "../../src/application/fulfillment/reconcile-shipment-status.service.js";
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

async function createFixture(orderStatus: "SHIPPED" | "DELIVERED" = "SHIPPED") {
  const user = await prisma.user.create({
    data: {
      email: `${nextId("owner")}@sellora.test`,
      fullName: "Reconciliation Owner",
      passwordHash: "hashed"
    }
  });

  const seller = await prisma.seller.create({
    data: {
      ownerUserId: user.id,
      slug: nextId("seller"),
      displayName: "Reconciliation Seller"
    }
  });

  const customer = await prisma.customer.create({
    data: {
      sellerId: seller.id,
      name: "Reconciliation Customer",
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
      title: "Reconciliation Device",
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
          titleSnapshot: "Reconciliation Device",
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
      status: orderStatus === "DELIVERED" ? "DELIVERED" : "SHIPPED",
      bookingReference: "ship_ref_1",
      courierName: "karrio",
      trackingNumber: "TRK-1",
      providerStatus: orderStatus === "DELIVERED" ? "delivered" : null
    }
  });

  return {
    orderId: order.id
  };
}

class FakeShippingGateway implements ShippingGateway {
  statusCalls: ShipmentStatusRequest[] = [];

  constructor(private readonly statusResult: ShipmentStatusResult) {}

  async bookShipment(_request: ShipmentBookingRequest): Promise<ShipmentBookingResult> {
    throw new Error("not used");
  }

  async getShipmentStatus(request: ShipmentStatusRequest): Promise<ShipmentStatusResult> {
    this.statusCalls.push(request);
    return this.statusResult;
  }
}

function createReconciliationServices(gateway: ShippingGateway) {
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
  const service = new ReconcileShipmentStatusService(
    fulfillmentRepository,
    gateway,
    handleShippingWebhookService
  );

  return { eventBus, service };
}

describe.sequential("Shipment reconciliation DB integration", () => {
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
    "recovers a missed delivered webhook through reconciliation",
    async () => {
      const fixture = await createFixture("SHIPPED");
      const gateway = new FakeShippingGateway({
        success: true,
        provider: "karrio",
        providerReference: "ship_ref_1",
        trackingNumber: "TRK-1",
        normalizedStatus: "delivered",
        observedAt: "2026-04-06T00:00:00.000Z",
        rawPayload: {
          id: "ship_ref_1",
          tracking_number: "TRK-1",
          status: "delivered",
          updated_at: "2026-04-06T00:00:00.000Z"
        }
      });
      const { eventBus, service } = createReconciliationServices(gateway);

      const first = await service.execute({
        orderId: fixture.orderId
      });
      const second = await service.execute({
        orderId: fixture.orderId
      });

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: fixture.orderId }
      });
      const fulfillment = await prisma.fulfillmentRecord.findUniqueOrThrow({
        where: { orderId: fixture.orderId }
      });
      const receipts = await prisma.shippingWebhookReceipt.findMany();

      expect(first.duplicate).toBe(false);
      expect(first.deliveredHandoff).toBe(true);
      expect(second.duplicate).toBe(true);
      expect(second.noChange).toBe(true);
      expect(order.status).toBe("DELIVERED");
      expect(fulfillment.providerStatus).toBe("delivered");
      expect(receipts).toHaveLength(1);
      expect(gateway.statusCalls).toHaveLength(1);
      expect(eventBus.events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
    },
    30000
  );

  it(
    "no-ops already-synced delivered shipments without querying provider again",
    async () => {
      const fixture = await createFixture("DELIVERED");
      const gateway = new FakeShippingGateway({
        success: true,
        provider: "karrio",
        providerReference: "ship_ref_1",
        trackingNumber: "TRK-1",
        normalizedStatus: "delivered",
        observedAt: "2026-04-06T00:00:00.000Z",
        rawPayload: {
          id: "ship_ref_1",
          tracking_number: "TRK-1",
          status: "delivered"
        }
      });
      const { service } = createReconciliationServices(gateway);

      const result = await service.execute({
        orderId: fixture.orderId
      });

      const receipts = await prisma.shippingWebhookReceipt.findMany();

      expect(result.duplicate).toBe(true);
      expect(result.noChange).toBe(true);
      expect(gateway.statusCalls).toHaveLength(0);
      expect(receipts).toHaveLength(0);
    },
    30000
  );

  it(
    "falls back to fulfillment provider status when tracker lookup is unavailable",
    async () => {
      const fixture = await createFixture("SHIPPED");
      await prisma.fulfillmentRecord.update({
        where: { orderId: fixture.orderId },
        data: {
          status: "DELIVERED",
          providerStatus: "delivered"
        }
      });
      const gateway = new FakeShippingGateway({
        success: false,
        provider: "karrio",
        failureMessage: "Tracking not found"
      });
      const { service } = createReconciliationServices(gateway);

      const result = await service.execute({
        orderId: fixture.orderId
      });

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: fixture.orderId }
      });
      const receipts = await prisma.shippingWebhookReceipt.findMany();

      expect(result.duplicate).toBe(false);
      expect(result.deliveredHandoff).toBe(true);
      expect(order.status).toBe("DELIVERED");
      expect(receipts).toHaveLength(1);
      expect(gateway.statusCalls).toHaveLength(1);
    },
    30000
  );
});
