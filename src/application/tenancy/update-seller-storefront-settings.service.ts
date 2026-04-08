import type { StorefrontSettings } from "../../domain/tenancy/seller.js";
import type {
  StorefrontSettingsRepository,
  UpdateStorefrontSettingsInput
} from "../../ports/storefront-settings-repository.js";

export interface UpdateSellerStorefrontSettingsRequest {
  sellerId: string;
  brandName?: string;
  primaryLocale?: string;
  supportPhone?: string | null;
  supportWhatsApp?: string | null;
  categoryKeys?: string[];
  trustPolicyIds?: string[];
}

function normalizeOptionalString(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalStringArray(value: string[] | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(normalized));
}

function normalizePatch(input: UpdateSellerStorefrontSettingsRequest): UpdateStorefrontSettingsInput["patch"] {
  return {
    brandName: input.brandName?.trim(),
    primaryLocale: input.primaryLocale?.trim(),
    supportPhone: normalizeOptionalString(input.supportPhone),
    supportWhatsApp: normalizeOptionalString(input.supportWhatsApp),
    categoryKeys: normalizeOptionalStringArray(input.categoryKeys),
    trustPolicyIds: normalizeOptionalStringArray(input.trustPolicyIds)
  };
}

export class UpdateSellerStorefrontSettingsService {
  constructor(private readonly storefrontSettingsRepository: StorefrontSettingsRepository) {}

  async execute(input: UpdateSellerStorefrontSettingsRequest): Promise<StorefrontSettings> {
    return this.storefrontSettingsRepository.updateBySellerId({
      sellerId: input.sellerId,
      patch: normalizePatch(input)
    });
  }
}
