import type { StorefrontSettings } from "../../domain/tenancy/seller.js";
import type { StorefrontSettingsRepository } from "../../ports/storefront-settings-repository.js";

export class GetSellerStorefrontSettingsService {
  constructor(private readonly storefrontSettingsRepository: StorefrontSettingsRepository) {}

  async execute(sellerId: string): Promise<StorefrontSettings> {
    const storefront = await this.storefrontSettingsRepository.getBySellerId(sellerId);
    if (!storefront) {
      throw new Error(`Storefront settings not found for seller ${sellerId}`);
    }

    return storefront;
  }
}
