import type {
  Opportunity,
  SourceListing
} from "../../domain/opportunities/opportunity.js";

export interface OpportunityScoringInput {
  listing: SourceListing;
  estimatedSellPriceMinor?: number;
  estimatedShippingMinor?: number;
  targetMarginPct?: number;
  sellerCategoryFit?: number;
  sourceQualityScore?: number;
  localizationReadiness?: number;
  riskPenalty?: number;
}

export interface OpportunityScoringResult {
  estimatedCostMinor: number;
  estimatedMarginMinor: number;
  estimatedMarginPct: number;
  opportunityScore: number;
  fitScore: number;
  riskScore: number;
  localizationScore: number;
  rankingReasons: string[];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function scoreOpportunity(input: OpportunityScoringInput): OpportunityScoringResult {
  const estimatedCostMinor = input.listing.sourcePriceMinor ?? 0;
  const estimatedShippingMinor = input.estimatedShippingMinor ?? 0;
  const landedCostMinor = estimatedCostMinor + estimatedShippingMinor;
  const targetMarginPct = input.targetMarginPct ?? 35;
  const estimatedSellPriceMinor =
    input.estimatedSellPriceMinor ??
    Math.ceil((landedCostMinor * (100 + targetMarginPct)) / 100);
  const sellerCategoryFit = input.sellerCategoryFit ?? 50;
  const sourceQualityScore = input.sourceQualityScore ?? 50;
  const localizationScore = input.localizationReadiness ?? 50;
  const riskPenalty = input.riskPenalty ?? 25;

  const estimatedMarginMinor = estimatedSellPriceMinor - landedCostMinor;
  const estimatedMarginPct =
    estimatedSellPriceMinor > 0 ? (estimatedMarginMinor / estimatedSellPriceMinor) * 100 : 0;

  const rawOpportunityScore =
    estimatedMarginPct * 0.45 +
    sellerCategoryFit * 0.2 +
    sourceQualityScore * 0.15 +
    localizationScore * 0.1 +
    (100 - riskPenalty) * 0.1;

  const reasons: string[] = [];

  if (estimatedMarginPct >= 30) {
    reasons.push("healthy_margin_profile");
  }

  if (sellerCategoryFit >= 70) {
    reasons.push("strong_category_fit");
  }

  if (localizationScore >= 70) {
    reasons.push("localization_ready");
  }

  if (riskPenalty >= 60) {
    reasons.push("elevated_risk");
  }

  return {
    estimatedCostMinor: landedCostMinor,
    estimatedMarginMinor,
    estimatedMarginPct,
    opportunityScore: clampScore(rawOpportunityScore),
    fitScore: clampScore(sellerCategoryFit),
    riskScore: clampScore(riskPenalty),
    localizationScore: clampScore(localizationScore),
    rankingReasons: reasons
  };
}

export function promoteOpportunityToReview(opportunity: Opportunity): Opportunity {
  return {
    ...opportunity,
    status: "review_required",
    updatedAt: new Date().toISOString()
  };
}
