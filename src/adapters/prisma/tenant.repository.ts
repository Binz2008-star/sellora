import { Prisma } from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type {
  CreateTenantInput,
  CreateTenantResult,
  TenantRepository,
  TenantSeller,
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

        return {
          user: mapUser(user as UserRecord),
          seller: mapSeller(seller as SellerRecord)
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
