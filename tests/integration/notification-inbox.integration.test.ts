import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db/prisma.js";
import { PrismaNotificationRepository } from "../../src/adapters/prisma/notification.repository.js";
import { PrismaNotificationQueryRepository } from "../../src/adapters/prisma/notification-query.repository.js";
import { AcknowledgeNotificationService } from "../../src/application/notifications/acknowledge-notification.service.js";

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

async function createFixture() {
  const owner = await prisma.user.create({
    data: {
      email: `${nextId("owner")}@sellora.test`,
      fullName: "Inbox Owner",
      passwordHash: "hashed"
    }
  });

  const seller = await prisma.seller.create({
    data: {
      ownerUserId: owner.id,
      slug: nextId("seller"),
      displayName: "Inbox Seller",
      customers: {
        create: {
          name: "Inbox Customer",
          phone: nextId("phone"),
          email: `${nextId("customer")}@sellora.test`
        }
      }
    },
    include: {
      customers: true
    }
  });

  const category = await prisma.categoryTemplate.create({
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
      categoryTemplateId: category.id,
      slug: nextId("product"),
      title: "Inbox Device",
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
      customerId: seller.customers[0].id,
      orderNumber: nextId("SOR"),
      mode: "STANDARD",
      status: "CONFIRMED",
      paymentPolicy: "FULL_UPFRONT",
      paymentStatus: "PAID",
      subtotalMinor: 10000,
      totalMinor: 10000,
      currency: "AED",
      lines: {
        create: {
          productId: product.id,
          productOfferingId: offering.id,
          titleSnapshot: "Inbox Device",
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

  return {
    sellerId: seller.id,
    orderId: order.id
  };
}

describeIfDatabase("Notification inbox DB integration", () => {
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
    "lists scoped notifications, keeps duplicates deduped, and acknowledges idempotently",
    async () => {
      const fixture = await createFixture();
      const notificationRepository = new PrismaNotificationRepository();
      const queryRepository = new PrismaNotificationQueryRepository();
      const acknowledgeService = new AcknowledgeNotificationService(notificationRepository);

      const created = await notificationRepository.createPendingLog({
        sellerId: fixture.sellerId,
        orderId: fixture.orderId,
        recipientRole: "customer",
        recipientAddress: "customer@sellora.test",
        templateKey: "payment_succeeded",
        eventType: "payment_succeeded",
        eventIdempotencyKey: "payment_event_1",
        notificationKey: "notify_unique_1",
        subject: "Payment received",
        body: "Hello"
      });

      const duplicate = await notificationRepository.createPendingLog({
        sellerId: fixture.sellerId,
        orderId: fixture.orderId,
        recipientRole: "customer",
        recipientAddress: "customer@sellora.test",
        templateKey: "payment_succeeded",
        eventType: "payment_succeeded",
        eventIdempotencyKey: "payment_event_1",
        notificationKey: "notify_unique_1",
        subject: "Payment received",
        body: "Hello"
      });

      expect(created.duplicate).toBe(false);
      expect(duplicate.duplicate).toBe(true);

      const beforeAck = await queryRepository.listNotifications({
        sellerId: fixture.sellerId,
        acknowledged: false
      });

      expect(beforeAck).toHaveLength(1);
      expect(beforeAck[0].notificationKey).toBe("notify_unique_1");

      const acknowledged = await acknowledgeService.execute({
        notificationId: created.log.id,
        sellerId: fixture.sellerId
      });
      const acknowledgedAgain = await acknowledgeService.execute({
        notificationId: created.log.id,
        sellerId: fixture.sellerId
      });

      expect(acknowledged.acknowledgedBySellerId).toBe(fixture.sellerId);
      expect(acknowledgedAgain.acknowledgedBySellerId).toBe(fixture.sellerId);

      const afterAck = await queryRepository.listNotifications({
        sellerId: fixture.sellerId,
        acknowledged: true
      });
      const detail = await queryRepository.getNotificationDetail(created.log.id);

      expect(afterAck).toHaveLength(1);
      expect(afterAck[0].acknowledgedBySellerId).toBe(fixture.sellerId);
      expect(detail?.id).toBe(created.log.id);
    },
    30000
  );
});
