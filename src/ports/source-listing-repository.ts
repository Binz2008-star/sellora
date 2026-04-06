import type { SourceListing } from "../domain/opportunities/opportunity.js";

export interface CreateSourceListingInput {
  sellerId: string;
  supplierSourceId?: string;
  sourceType: string;
  sourceUrl?: string;
  externalListingId?: string;
  sourceTitle: string;
  sourcePriceMinor?: number;
  sourceCurrency?: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload: Record<string, unknown>;
  discoveredAt: string;
}

export interface SourceListingRepository {
  create(input: CreateSourceListingInput): Promise<SourceListing>;
}
