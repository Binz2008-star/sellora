import type { Opportunity } from "../domain/opportunities/opportunity.js";

export interface CreateOpportunityInput {
  sellerId: string;
  sourceListingId: string;
  status: Opportunity["status"];
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
  aiDraft?: Record<string, unknown>;
  reviewNotes?: string;
}

export interface OpportunityRepository {
  create(input: CreateOpportunityInput): Promise<Opportunity>;
  updateStatus(opportunityId: string, status: Opportunity["status"], reviewNotes?: string): Promise<Opportunity>;
}
