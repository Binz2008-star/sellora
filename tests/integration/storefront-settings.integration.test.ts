import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaStorefrontSettingsRepository } from "../../src/adapters/prisma/storefront-settings.repository.js";
import { PrismaTenantRepository } from "../../src/adapters/prisma/tenant.repository.js";
import { CreateTenantService } from "../../src/application/tenancy/create-tenant.service.js";
import { GetSellerStorefrontSettingsService } from "../../src/application/tenancy/get-seller-storefront-settings.service.js";
import { UpdateSellerStorefrontSettingsService } from "../../src/application/tenancy/update-seller-storefront-settings.service.js";
import { prisma } from "../../src/core/db/prisma.js";

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${Date.now()}_${sequence}`;
}

async function cleanupDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "PaymentAttempt",
      "FulfillmentRecord",
      "ShippingWebhookReceipt",
      "NotificationLog",
      "InventoryMovement",
      "ProductOffering",
      "ProductMedia",
      "ProductInspection",
      "Product",
      "Customer",
      "StorefrontSettings",
      "StaffMembership",
      "SellerAutonomyPolicy",
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

describe.sequential("Storefront settings integration", () => {
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

  it("reads storefront defaults created during tenant onboarding", async () => {
    const createTenantService = new CreateTenantService(new PrismaTenantRepository());
    const queryService = new GetSellerStorefrontSettingsService(new PrismaStorefrontSettingsRepository());

    const tenant = await createTenantService.execute({
      email: `${nextId("seller")}@sellora.test`,
      fullName: "Seller One",
      brandName: "Seller Brand",
      slug: nextId("tenant"),
      whatsappNumber: "+971500000001"
    });

    const storefront = await queryService.execute(tenant.seller.id);

    expect(storefront.sellerId).toBe(tenant.seller.id);
    expect(storefront.brandName).toBe("Seller Brand");
    expect(storefront.supportWhatsApp).toBe("+971500000001");
  });

  it("updates only the targeted seller storefront without leaking to another tenant", async () => {
    const createTenantService = new CreateTenantService(new PrismaTenantRepository());
    const updateService = new UpdateSellerStorefrontSettingsService(new PrismaStorefrontSettingsRepository());

    const sellerOne = await createTenantService.execute({
      email: `${nextId("seller")}@sellora.test`,
      fullName: "Seller One",
      brandName: "Seller One Brand",
      slug: nextId("tenant")
    });

    const sellerTwo = await createTenantService.execute({
      email: `${nextId("seller")}@sellora.test`,
      fullName: "Seller Two",
      brandName: "Seller Two Brand",
      slug: nextId("tenant")
    });

    const updated = await updateService.execute({
      sellerId: sellerOne.seller.id,
      brandName: "Seller One Updated",
      primaryLocale: "ar-AE",
      supportPhone: "+971400000001",
      categoryKeys: ["electronics"],
      trustPolicyIds: ["trusted-seller"]
    });

    const persistedOne = await prisma.storefrontSettings.findUniqueOrThrow({
      where: { sellerId: sellerOne.seller.id }
    });
    const persistedTwo = await prisma.storefrontSettings.findUniqueOrThrow({
      where: { sellerId: sellerTwo.seller.id }
    });

    expect(updated.sellerId).toBe(sellerOne.seller.id);
    expect(persistedOne.brandName).toBe("Seller One Updated");
    expect(persistedOne.primaryLocale).toBe("ar-AE");
    expect(persistedTwo.brandName).toBe("Seller Two Brand");
    expect(persistedTwo.primaryLocale).toBe("en-AE");
  });
});
