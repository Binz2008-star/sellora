export interface BrowserExtractionRequest {
  sourceUrl: string;
  extractionProfile: string;
}

export interface BrowserExtractionResult {
  title?: string;
  priceText?: string;
  currency?: string;
  attributes: Record<string, unknown>;
  rawHtmlSnapshotId?: string;
}

export interface BrowserAutomationPort {
  extract(request: BrowserExtractionRequest): Promise<BrowserExtractionResult>;
}
