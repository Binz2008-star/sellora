import type {
  CatalogEnrichmentInput,
  CatalogEnrichmentOutput
} from "../../domain/ai/catalog-enrichment.js";

export function createDraftEnrichment(input: CatalogEnrichmentInput): CatalogEnrichmentOutput {
  return {
    cleanedTitle: input.sourceTitle.trim(),
    localizedTitle: input.targetLocale === "ar-AE" ? undefined : input.sourceTitle.trim(),
    localizedDescription: input.sourceDescription?.trim(),
    normalizedAttributes: input.sourceAttributes,
    merchandisingHighlights: [],
    pricingHints: {
      suggestedCurrency: input.targetCurrency
    },
    reviewFlags: ["manual_review_required"]
  };
}
