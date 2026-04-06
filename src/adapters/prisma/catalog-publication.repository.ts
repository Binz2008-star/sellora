import { prisma } from "../../core/db/prisma.js";
import { InventoryMode as PrismaInventoryMode, Prisma } from "@prisma/client";
import type {
  CatalogPublicationRepository,
  CreateCatalogPublicationInput
} from "../../ports/catalog-publication-repository.js";
import type {
  InventoryMovement,
  Product,
  ProductOffering
} from "../../domain/catalog/product.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function inventoryModeFromPrisma(value: string): ProductOffering["inventoryMode"] {
  return value.toLowerCase().replace("_", "-") as ProductOffering["inventoryMode"];
}

function mapProduct(record: {
  id: string;
  sellerId: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  attributesJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Product {
  return {
    id: record.id,
    sellerId: record.sellerId,
    categoryKey: "",
    slug: record.slug,
    title: record.title,
    description: record.description ?? undefined,
    status: record.status.toLowerCase() as Product["status"],
    attributes: ((record.attributesJson as Record<string, unknown>) ?? {}) as KeyValueRecord,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapOffering(record: {
  id: string;
  sellerId: string;
  productId: string;
  sku: string;
  inventoryMode: string;
  currency: string;
  priceMinor: number;
  costPriceMinor: number;
  depositMinor: number | null;
  isActive: boolean;
  sourceListingId: string | null;
  selectedAttributesJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ProductOffering {
  return {
    id: record.id,
    sellerId: record.sellerId,
    productId: record.productId,
    sku: record.sku,
    inventoryMode: inventoryModeFromPrisma(record.inventoryMode),
    price: {
      amountMinor: record.priceMinor,
      currency: record.currency
    },
    costPrice: {
      amountMinor: record.costPriceMinor,
      currency: record.currency
    },
    deposit:
      record.depositMinor !== null
        ? {
            amountMinor: record.depositMinor,
            currency: record.currency
          }
        : undefined,
    isActive: record.isActive,
    sourceListingId: record.sourceListingId ?? undefined,
    selectedAttributes: ((record.selectedAttributesJson as Record<string, unknown>) ?? {}) as KeyValueRecord,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapInventoryMovement(record: {
  id: string;
  sellerId: string;
  productOfferingId: string;
  type: string;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): InventoryMovement {
  return {
    id: record.id,
    sellerId: record.sellerId,
    productOfferingId: record.productOfferingId,
    type: record.type.toLowerCase() as InventoryMovement["type"],
    quantity: record.quantity,
    referenceType: record.referenceType ?? undefined,
    referenceId: record.referenceId ?? undefined,
    notes: record.notes ?? undefined,
    occurredAt: record.occurredAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export class PrismaCatalogPublicationRepository implements CatalogPublicationRepository {
  async create(input: CreateCatalogPublicationInput) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const categoryTemplate = await tx.categoryTemplate.findUnique({
        where: {
          key: input.categoryKey
        },
        select: {
          id: true,
          key: true
        }
      });

      if (!categoryTemplate) {
        throw new Error(`Unknown category template: ${input.categoryKey}`);
      }

      const slugBase = slugify(input.title) || "listing";
      const sku = input.sku.trim().toUpperCase();

      const productRecord = await tx.product.create({
        data: {
          sellerId: input.sellerId,
          categoryTemplateId: categoryTemplate.id,
          slug: `${slugBase}-${Date.now().toString(36)}`,
          title: input.title,
          description: input.description,
          status: "ACTIVE",
          attributesJson: input.attributes as Prisma.InputJsonValue
        }
      });

      const offeringRecord = await tx.productOffering.create({
        data: {
          sellerId: input.sellerId,
          productId: productRecord.id,
          sourceListingId: input.sourceListingId,
          sku,
          inventoryMode: input.inventoryMode.toUpperCase().replace("-", "_") as PrismaInventoryMode,
          currency: input.currency,
          priceMinor: input.priceMinor,
          costPriceMinor: input.costPriceMinor,
          depositMinor: input.depositMinor,
          isActive: true,
          selectedAttributesJson: input.selectedAttributes as Prisma.InputJsonValue
        }
      });

      let inventoryMovementRecord: {
        id: string;
        sellerId: string;
        productOfferingId: string;
        type: string;
        quantity: number;
        referenceType: string | null;
        referenceId: string | null;
        notes: string | null;
        occurredAt: Date;
        createdAt: Date;
        updatedAt: Date;
      } | null = null;

      if ((input.initialQuantity ?? 0) > 0) {
        inventoryMovementRecord = await tx.inventoryMovement.create({
          data: {
            sellerId: input.sellerId,
            productOfferingId: offeringRecord.id,
            type: "RECEIVE",
            quantity: input.initialQuantity ?? 0,
            referenceType: "catalog_publication",
            referenceId: offeringRecord.id,
            notes: "Initial inventory created during autonomous publication"
          }
        });
      }

      return {
        product: {
          ...mapProduct(productRecord),
          categoryKey: categoryTemplate.key
        },
        offering: mapOffering(offeringRecord),
        initialInventoryMovement: inventoryMovementRecord
          ? mapInventoryMovement(inventoryMovementRecord)
          : undefined
      };
    });
  }
}
