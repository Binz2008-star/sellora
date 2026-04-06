import type { AuditStamp, EntityId, KeyValueRecord } from "../shared/types.js";

export interface VerificationTemplate {
  id: EntityId;
  categoryKey: string;
  version: number;
  checkKeys: string[];
}

export interface ProductInspection extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  productId: EntityId;
  categoryKey: string;
  templateId: EntityId;
  status: "pending" | "passed" | "failed" | "needs_review";
  checkResults: KeyValueRecord;
  notes?: string;
}

export interface WarrantyPolicy {
  id: EntityId;
  sellerId: EntityId;
  categoryKey: string;
  displayName: string;
  durationDays: number;
  termsSummary: string;
}
