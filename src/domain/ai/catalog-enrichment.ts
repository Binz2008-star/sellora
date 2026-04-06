import type { KeyValueRecord } from "../shared/types.js";

export interface CatalogEnrichmentInput {
  sourcePlatform: string;
  sourceTitle: string;
  sourceDescription?: string;
  sourceAttributes: KeyValueRecord;
  targetLocale: string;
  targetCurrency: string;
}

export interface CatalogEnrichmentOutput {
  cleanedTitle: string;
  localizedTitle?: string;
  localizedDescription?: string;
  normalizedAttributes: KeyValueRecord;
  merchandisingHighlights: string[];
  pricingHints: {
    suggestedCurrency: string;
    suggestedMarginPercent?: number;
  };
  reviewFlags: string[];
}
