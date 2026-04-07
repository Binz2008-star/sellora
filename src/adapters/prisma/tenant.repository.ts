import { Prisma } from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type {
  CreateTenantInput,
  CreateTenantResult,
  TenantRepository,
  TenantSeller,
  TenantStaffMembership,
  TenantStorefront,
  TenantUser
} from "../../ports/tenant-repository.js";

const TENANT_BOOTSTRAP_PASSWORD_HASH = "tenant-bootstrap-pending";

type UserRecord = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type SellerRecord = {
  id: string;
  ownerUserId: string;
  slug: string;
  displayName: string;
  status: string;
  defaultCurrency: string;
  createdAt: Date;
  updatedAt: Date;
};

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

type StaffMembershipRecord = {
  sellerId: string;
  userId: string;
  role: string;
  createdAt: Date;
};

function mapUser(record: UserRecord): TenantUser {
  return {
    id: record.id,
    email: record.email,
    fullName: record.fullName,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapSeller(record: SellerRecord): TenantSeller {
  return {
    id: record.id,
    ownerUserId: record.ownerUserId,
    slug: record.slug,
    displayName: record.displayName,
    status: record.status.toLowerCase() as TenantSeller["status"],
    defaultCurrency: record.defaultCurrency,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapStorefront(record: StorefrontRecord): TenantStorefront {
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

function mapOwnerMembership(record: StaffMembershipRecord): TenantStaffMembership {
  return {
    sellerId: record.sellerId,
    userId: record.userId,
    role: record.role as TenantStaffMembership["role"],
    createdAt: record.createdAt.toISOString()
  };
}

function mapTenantConflict(error: Prisma.PrismaClientKnownRequestError): Error {
  const target = Array.isArray(error.meta?.target)
    ? error.meta.target.join(",")
    : String(error.meta?.target ?? "");

  if (target.includes("email")) {
    return new Error("Tenant owner email already exists");
  }

  if (target.includes("slug")) {
    return new Error("Tenant slug already exists");
  }

  return new Error("Tenant already exists");
}

export class PrismaTenantRepository implements TenantRepository {
  async createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.create({
          data: {
            email: input.email,
            fullName: input.fullName,
            passwordHash: TENANT_BOOTSTRAP_PASSWORD_HASH,
            isActive: true
          }
        });

        const seller = await tx.seller.create({
          data: {
            ownerUserId: user.id,
            slug: input.slug,
            displayName: input.brandName,
            defaultCurrency: input.currency
          }
        });

        const storefront = await tx.storefrontSettings.create({
          data: {
            sellerId: seller.id,
            brandName: input.brandName,
            supportWhatsApp: input.whatsappNumber,
            categoryKeys: [],
            trustPolicyIds: []
          }
        });

        const ownerMembership = await tx.staffMembership.create({
          data: {
            sellerId: seller.id,
            userId: user.id,
            role: "owner"
          }
        });

        return {
          user: mapUser(user as UserRecord),
          seller: mapSeller(seller as SellerRecord),
          storefront: mapStorefront(storefront as StorefrontRecord),
          ownerMembership: mapOwnerMembership(ownerMembership as StaffMembershipRecord)
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw mapTenantConflict(error);
      }

      throw error;
    }
  }
}
