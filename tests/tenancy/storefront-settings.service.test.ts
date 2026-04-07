import { describe, expect, it, vi } from "vitest";
import { GetSellerStorefrontSettingsService } from "../../src/application/tenancy/get-seller-storefront-settings.service.js";
import { UpdateSellerStorefrontSettingsService } from "../../src/application/tenancy/update-seller-storefront-settings.service.js";
import type { StorefrontSettings } from "../../src/domain/tenancy/seller.js";
import type { StorefrontSettingsRepository } from "../../src/ports/storefront-settings-repository.js";

function makeStorefront(sellerId = "seller_1"): StorefrontSettings {
  return {
    sellerId,
    brandName: "Seller One",
    primaryLocale: "en-AE",
    supportWhatsApp: "+971500000001",
    categoryKeys: [],
    trustPolicyIds: [],
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z"
  };
}

class FakeStorefrontSettingsRepository implements StorefrontSettingsRepository {
  getBySellerId = vi.fn(async (sellerId: string) => makeStorefront(sellerId));
  updateBySellerId = vi.fn(async (input) => makeStorefront(input.sellerId));
}

describe("Seller storefront settings services", () => {
  it("reads storefront settings by seller scope", async () => {
    const repository = new FakeStorefrontSettingsRepository();
    const service = new GetSellerStorefrontSettingsService(repository);

    const storefront = await service.execute("seller_1");

    expect(repository.getBySellerId).toHaveBeenCalledWith("seller_1");
    expect(storefront.sellerId).toBe("seller_1");
  });

  it("normalizes editable storefront patch fields before persistence", async () => {
    const repository = new FakeStorefrontSettingsRepository();
    const service = new UpdateSellerStorefrontSettingsService(repository);

    await service.execute({
      sellerId: "seller_1",
      brandName: " Seller One Updated ",
      primaryLocale: " ar-AE ",
      supportPhone: " ",
      supportWhatsApp: " +971500009999 ",
      categoryKeys: [" electronics ", "electronics", " accessories "],
      trustPolicyIds: [" trusted-seller ", "trusted-seller"]
    });

    expect(repository.updateBySellerId).toHaveBeenCalledWith({
      sellerId: "seller_1",
      patch: {
        brandName: "Seller One Updated",
        primaryLocale: "ar-AE",
        supportPhone: null,
        supportWhatsApp: "+971500009999",
        categoryKeys: ["electronics", "accessories"],
        trustPolicyIds: ["trusted-seller"]
      }
    });
  });
});
