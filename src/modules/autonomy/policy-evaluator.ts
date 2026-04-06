import type { AgentPolicy } from "../../domain/autonomy/agent-runtime.js";
import type { Opportunity } from "../../domain/opportunities/opportunity.js";

export function canAutopublishOpportunity(
  policy: AgentPolicy,
  opportunity: Opportunity
): boolean {
  if (!policy.enabled || !policy.autoPublish) {
    return false;
  }

  if ((opportunity.riskScore ?? 100) > policy.maxRiskScore) {
    return false;
  }

  if (
    policy.minimumMarginPct !== undefined &&
    (opportunity.estimatedMarginPct ?? 0) < policy.minimumMarginPct
  ) {
    return false;
  }

  if (
    policy.minimumLocalizationScore !== undefined &&
    (opportunity.localizationScore ?? 0) < policy.minimumLocalizationScore
  ) {
    return false;
  }

  return true;
}
