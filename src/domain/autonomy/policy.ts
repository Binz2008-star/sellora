import type { KeyValueRecord } from "../shared/types.js";

export interface AutonomyPolicy {
  enabled: boolean;
  autoPublishEnabled: boolean;
  allowedSourceTypes: string[];
  allowedCategoryKeys: string[];
  minimumMarginPct: number;
  maximumRiskScore: number;
  minimumLocalizationScore: number;
  stockConfidenceThreshold: number;
  requireDuplicateCheck: boolean;
  metadata?: KeyValueRecord;
}
