import type {
  BrowserAutomationPort,
  BrowserExtractionRequest,
  BrowserExtractionResult
} from "../../ports/browser-automation.js";

export interface StagehandBrowserAutomationOptions {
  defaultProfile: string;
}

export class StagehandBrowserAutomation implements BrowserAutomationPort {
  constructor(private readonly options: StagehandBrowserAutomationOptions) {}

  async extract(request: BrowserExtractionRequest): Promise<BrowserExtractionResult> {
    void request;
    void this.options;
    throw new Error("StagehandBrowserAutomation is not wired yet");
  }
}
