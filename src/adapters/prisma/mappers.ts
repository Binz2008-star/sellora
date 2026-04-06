import type {
  AutonomousAction,
  AutonomousActionDecision
} from "../../domain/autonomy/action.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type { AutonomyPolicy } from "../../domain/autonomy/policy.js";
import type { WorkflowRun, WorkflowStatus } from "../../domain/autonomy/workflow.js";
import type { Opportunity, OpportunityStatus, SourceListing } from "../../domain/opportunities/opportunity.js";

type SourceListingRecord = {
  id: string;
  sellerId: string;
  supplierSourceId: string | null;
  sourceType: string;
  sourceUrl: string | null;
  externalListingId: string | null;
  sourceTitle: string;
  sourcePriceMinor: number | null;
  sourceCurrency: string | null;
  rawPayloadJson: unknown;
  normalizedJson: unknown;
  discoveredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type OpportunityRecord = {
  id: string;
  sellerId: string;
  sourceListingId: string;
  status: string;
  categoryKey: string | null;
  estimatedSellPriceMinor: number | null;
  estimatedCostMinor: number | null;
  estimatedShippingMinor: number | null;
  estimatedMarginMinor: number | null;
  estimatedMarginPct: number | null;
  opportunityScore: number | null;
  riskScore: number | null;
  fitScore: number | null;
  localizationScore: number | null;
  rankingReasonsJson: unknown;
  aiDraftJson: unknown;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PolicyRecord = {
  enabled: boolean;
  autoPublishEnabled: boolean;
  allowedSourceTypesJson: unknown;
  allowedCategoryKeysJson: unknown;
  minimumMarginPct: number;
  maximumRiskScore: number;
  minimumLocalizationScore: number;
  stockConfidenceThreshold: number;
  requireDuplicateCheck: boolean;
};

type WorkflowRunRecord = {
  id: string;
  sellerId: string;
  kind: string;
  status: string;
  subjectType: string;
  subjectId: string;
  currentStep: string;
  lastEventAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AutonomousActionRecord = {
  id: string;
  sellerId: string;
  role: string;
  actionType: string;
  subjectType: string;
  subjectId: string;
  decision: string;
  reasonCodesJson: unknown;
  metadataJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export function mapSourceListing(record: SourceListingRecord): SourceListing {
  return {
    id: record.id,
    sellerId: record.sellerId,
    supplierSourceId: record.supplierSourceId ?? undefined,
    sourceType: record.sourceType,
    sourceUrl: record.sourceUrl ?? undefined,
    externalListingId: record.externalListingId ?? undefined,
    sourceTitle: record.sourceTitle,
    sourcePriceMinor: record.sourcePriceMinor ?? undefined,
    sourceCurrency: record.sourceCurrency ?? undefined,
    rawPayload: ((record.rawPayloadJson as Record<string, unknown>) ?? {}) as KeyValueRecord,
    normalizedPayload: ((record.normalizedJson as Record<string, unknown>) ?? {}) as KeyValueRecord,
    discoveredAt: record.discoveredAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function mapOpportunity(record: OpportunityRecord): Opportunity {
  return {
    id: record.id,
    sellerId: record.sellerId,
    sourceListingId: record.sourceListingId,
    status: record.status.toLowerCase() as OpportunityStatus,
    categoryKey: record.categoryKey ?? undefined,
    estimatedSellPriceMinor: record.estimatedSellPriceMinor ?? undefined,
    estimatedCostMinor: record.estimatedCostMinor ?? undefined,
    estimatedShippingMinor: record.estimatedShippingMinor ?? undefined,
    estimatedMarginMinor: record.estimatedMarginMinor ?? undefined,
    estimatedMarginPct: record.estimatedMarginPct ?? undefined,
    opportunityScore: record.opportunityScore ?? undefined,
    riskScore: record.riskScore ?? undefined,
    fitScore: record.fitScore ?? undefined,
    localizationScore: record.localizationScore ?? undefined,
    rankingReasons: (record.rankingReasonsJson as string[] | null) ?? undefined,
    aiDraft: ((record.aiDraftJson as Record<string, unknown> | null) ?? undefined) as KeyValueRecord | undefined,
    reviewNotes: record.reviewNotes ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function mapAutonomyPolicy(record: PolicyRecord): AutonomyPolicy {
  return {
    enabled: record.enabled,
    autoPublishEnabled: record.autoPublishEnabled,
    allowedSourceTypes: (record.allowedSourceTypesJson as string[]) ?? [],
    allowedCategoryKeys: (record.allowedCategoryKeysJson as string[]) ?? [],
    minimumMarginPct: record.minimumMarginPct,
    maximumRiskScore: record.maximumRiskScore,
    minimumLocalizationScore: record.minimumLocalizationScore,
    stockConfidenceThreshold: record.stockConfidenceThreshold,
    requireDuplicateCheck: record.requireDuplicateCheck
  };
}

export function mapWorkflowRun(record: WorkflowRunRecord): WorkflowRun {
  return {
    id: record.id,
    sellerId: record.sellerId,
    kind: record.kind as WorkflowRun["kind"],
    status: record.status.toLowerCase() as WorkflowStatus,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    currentStep: record.currentStep,
    lastEventAt: record.lastEventAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function mapAutonomousAction(record: AutonomousActionRecord): AutonomousAction {
  return {
    id: record.id,
    sellerId: record.sellerId,
    role: record.role as AutonomousAction["role"],
    type: record.actionType as AutonomousAction["type"],
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    decision: record.decision.toLowerCase() as AutonomousActionDecision,
    reasonCodes: (record.reasonCodesJson as string[]) ?? [],
    metadata: ((record.metadataJson as Record<string, unknown>) ?? {}) as KeyValueRecord,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
