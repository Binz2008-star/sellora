import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db/prisma.js";
import { MemoryEventBus } from "../../src/adapters/memory/memory-event-bus.js";
import { PrismaFulfillmentRepository } from "../../src/adapters/prisma/fulfillment.repository.js";
import { PrismaOrderLifecycleRepository } from "../../src/adapters/prisma/order-lifecycle.repository.js";
import { BookOrderShipmentService } from "../../src/application/orders/book-order-shipment.service.js";
import { TransitionOrderService } from "../../src/application/orders/transition-order.service.js";
import type {
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

async function createPackingOrderFixture() {
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
      name: "Fulfillment Customer",
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
      title: "Booking Test Device",
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
      status: "PACKING",
      paymentPolicy: "FULL_UPFRONT",
      paymentStatus: "PAID",
      subtotalMinor: 10000,
      totalMinor: 10000,
      currency: "AED",
      lines: {
        create: {
          productId: product.id,
          productOfferingId: offering.id,
          titleSnapshot: "Booking Test Device",
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

  await prisma.inventoryMovement.create({
    data: {
      sellerId: seller.id,
      productOfferingId: offering.id,
      type: "RESERVE",
      quantity: 1,
      referenceType: "order",
      referenceId: order.id
    }
  });

  return {
    orderId: order.id
  };
}

class SuccessfulGateway implements ShippingGateway {
  async bookShipment(): Promise<ShipmentBookingResult> {
    return {
      success: true,
      provider: "karrio",
      providerReference: "shp_live_1",
      bookingReference: "shp_live_1",
      trackingNumber: "TRK-LIVE-1",
      trackingUrl: "https://track.example/TRK-LIVE-1",
      courierName: "karrio-carrier",
      rawPayload: {
        id: "shp_live_1",
        tracking_number: "TRK-LIVE-1",
        tracking_url: "https://track.example/TRK-LIVE-1"
      }
    };
  }

  async getShipmentStatus(_request: ShipmentStatusRequest): Promise<ShipmentStatusResult> {
    throw new Error("not used");
  }
}

class FailedGateway implements ShippingGateway {
  async bookShipment(): Promise<ShipmentBookingResult> {
    return {
      success: false,
      provider: "karrio",
      failureCode: "provider_error",
      failureMessage: "carrier rejected shipment",
      rawPayload: {
        error: "carrier rejected shipment"
      }
    };
  }

  async getShipmentStatus(_request: ShipmentStatusRequest): Promise<ShipmentStatusResult> {
    throw new Error("not used");
  }
}

function createServices(shippingGateway: ShippingGateway) {
  const eventBus = new MemoryEventBus();
  const transitionOrderService = new TransitionOrderService(
    new PrismaOrderLifecycleRepository(),
    eventBus
  );
  const service = new BookOrderShipmentService(
    new PrismaFulfillmentRepository(),
    shippingGateway,
    transitionOrderService
  );

  return { eventBus, service };
}

describe.sequential("Fulfillment booking DB integration", () => {
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
    "persists normalized tracking data and raw payload after successful booking",
    async () => {
      const fixture = await createPackingOrderFixture();
      const { service, eventBus } = createServices(new SuccessfulGateway());

      await service.execute({
        orderId: fixture.orderId
      });

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: fixture.orderId }
      });
      const fulfillment = await prisma.fulfillmentRecord.findUniqueOrThrow({
        where: { orderId: fixture.orderId }
      });

      expect(order.status).toBe("SHIPPED");
      expect(fulfillment.bookingReference).toBe("shp_live_1");
      expect(fulfillment.courierName).toBe("karrio-carrier");
      expect(fulfillment.trackingNumber).toBe("TRK-LIVE-1");
      expect(fulfillment.trackingUrl).toBe("https://track.example/TRK-LIVE-1");
      expect(fulfillment.rawPayloadJson).toEqual({
        id: "shp_live_1",
        tracking_number: "TRK-LIVE-1",
        tracking_url: "https://track.example/TRK-LIVE-1"
      });
      expect(eventBus.events.filter((event) => event.eventType === "order_status_changed")).toHaveLength(1);
      expect(eventBus.events.filter((event) => event.eventType === "fulfillment_status_changed")).toHaveLength(1);
    },
    30000
  );

  it(
    "does not mark order as shipped when provider booking fails",
    async () => {
      const fixture = await createPackingOrderFixture();
      const { service, eventBus } = createServices(new FailedGateway());

      await expect(
        service.execute({
          orderId: fixture.orderId
        })
      ).rejects.toThrow("carrier rejected shipment");

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: fixture.orderId }
      });
      const fulfillment = await prisma.fulfillmentRecord.findUnique({
        where: { orderId: fixture.orderId }
      });

      expect(order.status).toBe("PACKING");
      expect(fulfillment).toBeNull();
      expect(eventBus.events).toHaveLength(0);
    },
    30000
  );
});
