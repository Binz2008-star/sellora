import type { AuditStamp, EntityId } from "../shared/types.js";

export type SellerStatus = "active" | "paused" | "archived";

export interface Seller extends AuditStamp {
  id: EntityId;
  slug: string;
  displayName: string;
  legalName?: string;
  status: SellerStatus;
  defaultCurrency: string;
  supportedCategories: string[];
}

export interface StorefrontSettings {
  sellerId: EntityId;
  brandName: string;
  primaryLocale: string;
  supportPhone?: string;
  supportWhatsApp?: string;
  categoryKeys: string[];
  trustPolicyIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StaffRoleAssignment {
  sellerId: EntityId;
  userId: EntityId;
  role: "owner" | "manager" | "ops" | "support";
}
