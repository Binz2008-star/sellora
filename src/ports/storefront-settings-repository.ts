import type { StorefrontSettings } from "../domain/tenancy/seller.js";

export interface UpdateStorefrontSettingsInput {
  sellerId: string;
  patch: {
    brandName?: string;
    primaryLocale?: string;
    supportPhone?: string | null;
    supportWhatsApp?: string | null;
    categoryKeys?: string[];
    trustPolicyIds?: string[];
  };
}

export interface StorefrontSettingsRepository {
  getBySellerId(sellerId: string): Promise<StorefrontSettings | null>;
  updateBySellerId(input: UpdateStorefrontSettingsInput): Promise<StorefrontSettings>;
}
