import type { AuditStamp, EntityId, KeyValueRecord } from "../shared/types.js";

export type OpportunityStatus =
  | "discovered"
  | "scored"
  | "review_required"
  | "approved"
  | "rejected"
  | "published";

export interface SourceListing extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  supplierSourceId?: EntityId;
  sourceType: string;
  sourceUrl?: string;
  externalListingId?: string;
  sourceTitle: string;
  sourcePriceMinor?: number;
  sourceCurrency?: string;
  rawPayload?: KeyValueRecord;
  normalizedPayload?: KeyValueRecord;
  discoveredAt: string;
}

export interface Opportunity extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  sourceListingId: EntityId;
  status: OpportunityStatus;
  categoryKey?: string;
  estimatedSellPriceMinor?: number;
  estimatedCostMinor?: number;
  estimatedShippingMinor?: number;
  estimatedMarginMinor?: number;
  estimatedMarginPct?: number;
  opportunityScore?: number;
  riskScore?: number;
  fitScore?: number;
  localizationScore?: number;
  rankingReasons?: string[];
  aiDraft?: KeyValueRecord;
  reviewNotes?: string;
}
