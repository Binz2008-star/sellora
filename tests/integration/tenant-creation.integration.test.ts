import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaTenantRepository } from "../../src/adapters/prisma/tenant.repository.js";
import { CreateTenantService } from "../../src/application/tenancy/create-tenant.service.js";
import { prisma } from "../../src/core/db/prisma.js";

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${Date.now()}_${sequence}`;
}

async function cleanupDatabase() {
  // 1. Scalability: Fetch all table names dynamically (PostgreSQL specific)
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public';
  `;

  // 2. Error Handling & Maintenance: Clean everything except the migrations table
  const tableNames = tables
    .map((t) => t.tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"${name}"`)
    .join(', ');

  if (tableNames.length > 0) {
    try {
      // 3. Performance: Single query to truncate all tables efficiently
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
    } catch (error) {
      console.error("Database cleanup failed:", error);
      throw error;
    }
  }
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
    const persistedStorefront = await prisma.storefrontSettings.findUniqueOrThrow({
      where: { sellerId: result.seller.id }
    });
    const persistedMembership = await prisma.staffMembership.findUniqueOrThrow({
      where: {
        sellerId_userId: {
          sellerId: result.seller.id,
          userId: result.user.id
        }
      }
    });

    expect(persistedUser.email).toBe(result.user.email);
    expect(persistedSeller.ownerUserId).toBe(result.user.id);
    expect(persistedSeller.displayName).toBe("Tenant Brand");
    expect(persistedSeller.defaultCurrency).toBe("AED");
    expect(persistedSeller.status).toBe("ACTIVE");
    expect(persistedStorefront.brandName).toBe("Tenant Brand");
    expect(persistedStorefront.primaryLocale).toBe("en-AE");
    expect(persistedStorefront.supportWhatsApp).toBeNull();
    expect(persistedMembership.role).toBe("owner");
    expect(result.storefront.primaryLocale).toBe("en-AE");
    expect(result.ownerMembership.role).toBe("owner");
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
