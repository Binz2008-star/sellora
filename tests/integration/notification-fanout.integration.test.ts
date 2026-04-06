import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db/prisma.js";
import { MemoryEventBus } from "../../src/adapters/memory/memory-event-bus.js";
import { MemoryNotificationGateway } from "../../src/adapters/memory/memory-notification-gateway.js";
import { PrismaFulfillmentRepository } from "../../src/adapters/prisma/fulfillment.repository.js";
import { PrismaNotificationRepository } from "../../src/adapters/prisma/notification.repository.js";
import { PrismaOrderLifecycleRepository } from "../../src/adapters/prisma/order-lifecycle.repository.js";
import { PrismaPaymentRepository } from "../../src/adapters/prisma/payment.repository.js";
import { BookOrderShipmentService } from "../../src/application/orders/book-order-shipment.service.js";
import { ConfirmOrderDeliveryService } from "../../src/application/orders/confirm-order-delivery.service.js";
import { TransitionOrderService } from "../../src/application/orders/transition-order.service.js";
import { PaymentService } from "../../src/application/payments/payment.service.js";
import { SendOrderNotificationService } from "../../src/application/notifications/send-order-notification.service.js";
import { NotificationFanoutEventBus } from "../../src/modules/events/notification-fanout-event-bus.js";
import type {
  ShipmentBookingResult,
  ShipmentStatusRequest,
  ShipmentStatusResult,
  ShippingGateway
} from "../../src/ports/shipping-gateway.js";

const describeIfDatabase = process.env.DATABASE_URL ? describe.sequential : describe.skip;

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${Date.now()}_${sequence}`;
}

async function cleanupDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "NotificationLog",
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

async function createFixture(orderStatus: "PENDING_PAYMENT" | "PACKING", paymentStatus: "PENDING" | "PAID") {
  const user = await prisma.user.create({
    data: {
      email: `${nextId("owner")}@sellora.test`,
      fullName: "Notification Owner",
      passwordHash: "hashed"
    }
  });

  const seller = await prisma.seller.create({
    data: {
      ownerUserId: user.id,
      slug: nextId("seller"),
      displayName: "Notification Seller",
      customers: {
        create: {
          name: "Notification Customer",
          phone: nextId("phone"),
          email: `${nextId("customer")}@sellora.test`,
          city: "Dubai"
        }
      }
    },
    include: {
      customers: true
    }
  });

  const customer = seller.customers[0];

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
      title: "Notification Device",
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
      paymentStatus,
      subtotalMinor: 10000,
      totalMinor: 10000,
      currency: "AED",
      lines: {
        create: {
          productId: product.id,
          productOfferingId: offering.id,
          titleSnapshot: "Notification Device",
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

  if (orderStatus === "PACKING") {
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
  }

  const paymentAttempt =
    paymentStatus === "PENDING"
      ? await prisma.paymentAttempt.create({
          data: {
            sellerId: seller.id,
            orderId: order.id,
            provider: "stripe",
            amountMinor: 10000,
            currency: "AED",
            status: "PENDING"
          }
        })
      : null;

  return {
    sellerId: seller.id,
    orderId: order.id,
    paymentAttemptId: paymentAttempt?.id
  };
}

class SuccessfulGateway implements ShippingGateway {
  async bookShipment(): Promise<ShipmentBookingResult> {
    return {
      success: true,
      provider: "karrio",
      providerReference: "shp_notify_1",
      bookingReference: "shp_notify_1",
      trackingNumber: "TRK-NOTIFY-1",
      trackingUrl: "https://track.example/TRK-NOTIFY-1",
      courierName: "karrio-carrier",
      rawPayload: {
        id: "shp_notify_1"
      }
    };
  }

  async getShipmentStatus(_request: ShipmentStatusRequest): Promise<ShipmentStatusResult> {
    throw new Error("not used");
  }
}

function createServices(shippingGateway: ShippingGateway = new SuccessfulGateway()) {
  const innerEventBus = new MemoryEventBus();
  const notificationGateway = new MemoryNotificationGateway();
  const notificationService = new SendOrderNotificationService(
    new PrismaNotificationRepository(),
    notificationGateway
  );
  const eventBus = new NotificationFanoutEventBus(innerEventBus, notificationService);
  const transitionOrderService = new TransitionOrderService(
    new PrismaOrderLifecycleRepository(),
    eventBus
  );

  return {
    notificationGateway,
    paymentService: new PaymentService(
      new PrismaPaymentRepository(),
      transitionOrderService,
      undefined,
      eventBus
    ),
    bookOrderShipmentService: new BookOrderShipmentService(
      new PrismaFulfillmentRepository(),
      shippingGateway,
      transitionOrderService
    ),
    confirmOrderDeliveryService: new ConfirmOrderDeliveryService(
      new PrismaFulfillmentRepository(),
      transitionOrderService
    )
  };
}

describeIfDatabase("Notification fanout DB integration", () => {
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
    "creates notification logs for payment success, shipment booking, and delivery",
    async () => {
      const paymentFixture = await createFixture("PENDING_PAYMENT", "PENDING");
      const shipmentFixture = await createFixture("PACKING", "PAID");
      const services = createServices();

      await services.paymentService.markSucceeded({
        paymentAttemptId: paymentFixture.paymentAttemptId!,
        provider: "stripe",
        providerReference: "pi_notify_1"
      });

      await services.bookOrderShipmentService.execute({
        orderId: shipmentFixture.orderId
      });

      await services.confirmOrderDeliveryService.execute({
        orderId: shipmentFixture.orderId
      });

      const logs = await prisma.notificationLog.findMany({
        orderBy: { createdAt: "asc" }
      });

      expect(logs.map((log) => log.templateKey)).toEqual([
        "payment_succeeded",
        "shipment_booked",
        "order_delivered"
      ]);
      expect(logs.every((log) => log.status === "SENT")).toBe(true);
      expect(services.notificationGateway.sentEmails).toHaveLength(3);
    },
    30000
  );
});
