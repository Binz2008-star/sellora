import { prisma } from "../../core/db/prisma.js";
import type { StorefrontSettings } from "../../domain/tenancy/seller.js";
import type {
  StorefrontSettingsRepository,
  UpdateStorefrontSettingsInput
} from "../../ports/storefront-settings-repository.js";

type StorefrontRecord = {
  sellerId: string;
  brandName: string;
  primaryLocale: string;
  supportPhone: string | null;
  supportWhatsApp: string | null;
  categoryKeys: unknown;
  trustPolicyIds: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function mapStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapStorefront(record: StorefrontRecord): StorefrontSettings {
  return {
    sellerId: record.sellerId,
    brandName: record.brandName,
    primaryLocale: record.primaryLocale,
    supportPhone: record.supportPhone ?? undefined,
    supportWhatsApp: record.supportWhatsApp ?? undefined,
    categoryKeys: mapStringArray(record.categoryKeys),
    trustPolicyIds: mapStringArray(record.trustPolicyIds),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export class PrismaStorefrontSettingsRepository implements StorefrontSettingsRepository {
  async getBySellerId(sellerId: string): Promise<StorefrontSettings | null> {
    const record = await prisma.storefrontSettings.findUnique({
      where: { sellerId }
    });

    return record ? mapStorefront(record as unknown as StorefrontRecord) : null;
  }

  async updateBySellerId(input: UpdateStorefrontSettingsInput): Promise<StorefrontSettings> {
    const existing = await prisma.storefrontSettings.findUnique({
      where: { sellerId: input.sellerId }
    });

    if (!existing) {
      throw new Error(`Storefront settings not found for seller ${input.sellerId}`);
    }

    const record = await prisma.storefrontSettings.update({
      where: { sellerId: input.sellerId },
      data: {
        ...(input.patch.brandName !== undefined ? { brandName: input.patch.brandName } : {}),
        ...(input.patch.primaryLocale !== undefined ? { primaryLocale: input.patch.primaryLocale } : {}),
        ...(input.patch.supportPhone !== undefined ? { supportPhone: input.patch.supportPhone } : {}),
        ...(input.patch.supportWhatsApp !== undefined
          ? { supportWhatsApp: input.patch.supportWhatsApp }
          : {}),
        ...(input.patch.categoryKeys !== undefined ? { categoryKeys: input.patch.categoryKeys } : {}),
        ...(input.patch.trustPolicyIds !== undefined
          ? { trustPolicyIds: input.patch.trustPolicyIds }
          : {})
      }
    });

    return mapStorefront(record as unknown as StorefrontRecord);
  }
}
