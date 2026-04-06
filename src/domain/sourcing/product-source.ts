import type { AuditStamp, EntityId, KeyValueRecord } from "../shared/types.js";

export type SupplierPlatform =
  | "partner_feed"
  | "approved_web_source"
  | "manual_feed"
  | "csv_upload";
export type ImportJobStatus =
  | "pending"
  | "fetched"
  | "enriched"
  | "review_required"
  | "approved"
  | "rejected"
  | "published"
  | "failed";

export interface SupplierSource extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  platform: SupplierPlatform;
  displayName: string;
  externalId?: string;
  baseUrl?: string;
}

export interface ImportJob extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  supplierSourceId: EntityId;
  status: ImportJobStatus;
  sourceUrl?: string;
  externalProductId?: string;
  rawPayload?: KeyValueRecord;
  normalizedPayload?: KeyValueRecord;
  aiDraft?: KeyValueRecord;
  reviewNotes?: string;
}
