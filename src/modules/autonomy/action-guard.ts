import type { Opportunity } from "../../domain/opportunities/opportunity.js";
import type { AutonomyPolicy } from "../../domain/autonomy/policy.js";
import type {
  AutonomousActionDecision,
  AutonomousActionType
} from "../../domain/autonomy/action.js";

export interface ActionGuardInput {
  actionType: AutonomousActionType;
  policy: AutonomyPolicy;
  sourceType?: string;
  categoryKey?: string;
  opportunity?: Opportunity;
}

export interface ActionGuardResult {
  decision: AutonomousActionDecision;
  reasonCodes: string[];
}

export function evaluateAutonomousAction(input: ActionGuardInput): ActionGuardResult {
  const reasons: string[] = [];

  if (!input.policy.enabled) {
    return { decision: "blocked", reasonCodes: ["autonomy_disabled"] };
  }

  if (input.sourceType && !input.policy.allowedSourceTypes.includes(input.sourceType)) {
    return { decision: "blocked", reasonCodes: ["source_not_allowed"] };
  }

  if (input.categoryKey && !input.policy.allowedCategoryKeys.includes(input.categoryKey)) {
    return { decision: "blocked", reasonCodes: ["category_not_allowed"] };
  }

  if (input.actionType === "publish_listing") {
    if (!input.policy.autoPublishEnabled) {
      return { decision: "manual_only", reasonCodes: ["auto_publish_disabled"] };
    }

    const opportunity = input.opportunity;

    if (!opportunity) {
      return { decision: "blocked", reasonCodes: ["missing_opportunity"] };
    }

    if ((opportunity.estimatedMarginPct ?? 0) < input.policy.minimumMarginPct) {
      reasons.push("margin_below_threshold");
    }

    if ((opportunity.riskScore ?? 100) > input.policy.maximumRiskScore) {
      reasons.push("risk_above_threshold");
    }

    if ((opportunity.localizationScore ?? 0) < input.policy.minimumLocalizationScore) {
      reasons.push("localization_below_threshold");
    }

    if (reasons.length > 0) {
      return { decision: "blocked", reasonCodes: reasons };
    }
  }

  return { decision: "allowed", reasonCodes: [] };
}
