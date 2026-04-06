export interface DiscoverySourceProfile {
  sourceType: string;
  supportsStructuredImport: boolean;
  supportsManualReviewFlow: boolean;
  trustBaseline: number;
}

export const defaultDiscoverySources: DiscoverySourceProfile[] = [
  {
    sourceType: "supplier_csv",
    supportsStructuredImport: true,
    supportsManualReviewFlow: true,
    trustBaseline: 80
  },
  {
    sourceType: "partner_feed",
    supportsStructuredImport: true,
    supportsManualReviewFlow: true,
    trustBaseline: 75
  },
  {
    sourceType: "approved_web_source",
    supportsStructuredImport: false,
    supportsManualReviewFlow: true,
    trustBaseline: 45
  },
  {
    sourceType: "seller_sheet",
    supportsStructuredImport: true,
    supportsManualReviewFlow: true,
    trustBaseline: 70
  }
];

export function canUseDiscoverySource(sourceType: string): boolean {
  return defaultDiscoverySources.some((source) => source.sourceType === sourceType);
}
