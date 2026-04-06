import type {
  BrowserAutomationPort,
  BrowserExtractionRequest,
  BrowserExtractionResult
} from "../../ports/browser-automation.js";

export interface StaticBrowserAutomationResult extends BrowserExtractionResult {
  sourceUrl?: string;
}

export class StaticBrowserAutomation implements BrowserAutomationPort {
  constructor(private readonly result: StaticBrowserAutomationResult) {}

  async extract(request: BrowserExtractionRequest): Promise<BrowserExtractionResult> {
    return {
      ...this.result,
      attributes: {
        sourceUrl: request.sourceUrl,
        extractionProfile: request.extractionProfile,
        ...this.result.attributes
      }
    };
  }
}
