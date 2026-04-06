import type {
  InventoryMode,
  InventoryMovement,
  Product,
  ProductOffering
} from "../domain/catalog/product.js";

export interface CreateCatalogPublicationInput {
  sellerId: string;
  categoryKey: string;
  sourceListingId?: string;
  title: string;
  description?: string;
  attributes: Record<string, unknown>;
  sku: string;
  inventoryMode: InventoryMode;
  currency: string;
  priceMinor: number;
  costPriceMinor: number;
  depositMinor?: number;
  initialQuantity?: number;
  selectedAttributes: Record<string, unknown>;
}

export interface CatalogPublicationResult {
  product: Product;
  offering: ProductOffering;
  initialInventoryMovement?: InventoryMovement;
}

export interface CatalogPublicationRepository {
  create(input: CreateCatalogPublicationInput): Promise<CatalogPublicationResult>;
}
