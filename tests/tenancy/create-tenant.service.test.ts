import { describe, expect, it, vi } from "vitest";
import { CreateTenantService } from "../../src/application/tenancy/create-tenant.service.js";
import type { CreateTenantResult, TenantRepository } from "../../src/ports/tenant-repository.js";

class FakeTenantRepository implements TenantRepository {
  createTenant = vi.fn(async (input) => ({
    user: {
      id: "user_1",
      email: input.email,
      fullName: input.fullName,
      isActive: true,
      createdAt: "2026-04-07T00:00:00.000Z",
      updatedAt: "2026-04-07T00:00:00.000Z"
    },
    seller: {
      id: "seller_1",
      ownerUserId: "user_1",
      slug: input.slug,
      displayName: input.brandName,
      status: "active" as const,
      defaultCurrency: input.currency ?? "AED",
      createdAt: "2026-04-07T00:00:00.000Z",
      updatedAt: "2026-04-07T00:00:00.000Z"
    },
    storefront: {
      sellerId: "seller_1",
      brandName: input.brandName,
      primaryLocale: "en-AE",
      supportPhone: undefined,
      supportWhatsApp: input.whatsappNumber,
      categoryKeys: [],
      trustPolicyIds: [],
      createdAt: "2026-04-07T00:00:00.000Z",
      updatedAt: "2026-04-07T00:00:00.000Z"
    },
    ownerMembership: {
      sellerId: "seller_1",
      userId: "user_1",
      role: "owner",
      createdAt: "2026-04-07T00:00:00.000Z"
    }
  } satisfies CreateTenantResult));
}

describe("CreateTenantService", () => {
  it("normalizes tenant input before persisting", async () => {
    const repository = new FakeTenantRepository();
    const service = new CreateTenantService(repository);

    const result = await service.execute({
      email: " Seller@Sellora.Test ",
      fullName: " Seller One ",
      brandName: " Seller Brand ",
      slug: " Seller-One ",
      whatsappNumber: " +971500000001 ",
      currency: " usd "
    });

    expect(repository.createTenant).toHaveBeenCalledWith({
      email: "seller@sellora.test",
      fullName: "Seller One",
      brandName: "Seller Brand",
      slug: "seller-one",
      whatsappNumber: "+971500000001",
      currency: "USD"
    });
    expect(result.seller.defaultCurrency).toBe("USD");
    expect(result.storefront.supportWhatsApp).toBe("+971500000001");
    expect(result.ownerMembership.role).toBe("owner");
  });

  it("defaults tenant currency to AED when omitted", async () => {
    const repository = new FakeTenantRepository();
    const service = new CreateTenantService(repository);

    await service.execute({
      email: "seller@sellora.test",
      fullName: "Seller One",
      brandName: "Seller Brand",
      slug: "seller-one"
    });

    expect(repository.createTenant).toHaveBeenCalledWith({
      email: "seller@sellora.test",
      fullName: "Seller One",
      brandName: "Seller Brand",
      slug: "seller-one",
      whatsappNumber: undefined,
      currency: "AED"
    });
  });

  it("drops blank optional tenant fields while preserving the default currency", async () => {
    const repository = new FakeTenantRepository();
    const service = new CreateTenantService(repository);

    await service.execute({
      email: "seller@sellora.test",
      fullName: "Seller One",
      brandName: "Seller Brand",
      slug: "seller-one",
      whatsappNumber: "   ",
      currency: "   "
    });

    expect(repository.createTenant).toHaveBeenCalledWith({
      email: "seller@sellora.test",
      fullName: "Seller One",
      brandName: "Seller Brand",
      slug: "seller-one",
      whatsappNumber: undefined,
      currency: "AED"
    });
  });
});
