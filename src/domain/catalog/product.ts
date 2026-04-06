import type { AuditStamp, EntityId, KeyValueRecord, Money } from "../shared/types.js";

export type ProductStatus = "draft" | "active" | "inactive" | "archived";
export type InventoryMode = "stocked" | "unique-item" | "service";
export type InventoryMovementType =
  | "receive"
  | "reserve"
  | "release"
  | "deduct"
  | "adjust"
  | "return";

export interface Product extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  categoryKey: string;
  slug: string;
  title: string;
  description?: string;
  status: ProductStatus;
  attributes: KeyValueRecord;
}

export interface ProductOffering extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  productId: EntityId;
  sku: string;
  inventoryMode: InventoryMode;
  price: Money;
  costPrice: Money;
  deposit?: Money;
  isActive: boolean;
  sourceListingId?: EntityId;
  selectedAttributes: KeyValueRecord;
}

export interface InventoryMovement extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  productOfferingId: EntityId;
  type: InventoryMovementType;
  quantity: number;
  referenceType?: string;
  referenceId?: EntityId;
  notes?: string;
  occurredAt: string;
}

export interface ProductMedia {
  id: EntityId;
  productId: EntityId;
  url: string;
  altText?: string;
  sortOrder: number;
}

export function isReservableProduct(offering: ProductOffering): boolean {
  return offering.inventoryMode === "unique-item" || offering.deposit !== undefined;
}
