import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/core/db/prisma.js";
import { CreateTenantService } from "../../src/application/tenancy/create-tenant.service.js";
import { PrismaTenantRepository } from "../../src/adapters/prisma/tenant.repository.js";

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

describe.sequential("Tenant creation DB integration", () => {
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

  it("creates the owner user and seller atomically and keeps the seller addressable by slug", async () => {
    const service = new CreateTenantService(new PrismaTenantRepository());

    const result = await service.execute({
      email: `${nextId("seller")}@sellora.test`,
      fullName: "Tenant Owner",
      brandName: "Tenant Brand",
      slug: nextId("tenant"),
      currency: "AED"
    });

    const persistedUser = await prisma.user.findUniqueOrThrow({
      where: { id: result.user.id }
    });
    const persistedSeller = await prisma.seller.findUniqueOrThrow({
      where: { slug: result.seller.slug }
    });

    expect(persistedUser.email).toBe(result.user.email);
    expect(persistedSeller.ownerUserId).toBe(result.user.id);
    expect(persistedSeller.displayName).toBe("Tenant Brand");
    expect(persistedSeller.defaultCurrency).toBe("AED");
    expect(persistedSeller.status).toBe("ACTIVE");
  }, 30000);

  it("rolls back user creation when slug uniqueness fails", async () => {
    const service = new CreateTenantService(new PrismaTenantRepository());
    const slug = nextId("tenant");

    await service.execute({
      email: `${nextId("seller")}@sellora.test`,
      fullName: "First Owner",
      brandName: "Tenant One",
      slug
    });

    await expect(
      service.execute({
        email: `${nextId("seller")}@sellora.test`,
        fullName: "Second Owner",
        brandName: "Tenant Two",
        slug
      })
    ).rejects.toThrow("Tenant slug already exists");

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.seller.count()).toBe(1);
  }, 30000);

  it("rejects duplicate owner email without leaving an orphan seller", async () => {
    const service = new CreateTenantService(new PrismaTenantRepository());
    const email = `${nextId("seller")}@sellora.test`;

    await service.execute({
      email,
      fullName: "First Owner",
      brandName: "Tenant One",
      slug: nextId("tenant")
    });

    await expect(
      service.execute({
        email,
        fullName: "Second Owner",
        brandName: "Tenant Two",
        slug: nextId("tenant")
      })
    ).rejects.toThrow("Tenant owner email already exists");

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.seller.count()).toBe(1);
  }, 30000);
});
