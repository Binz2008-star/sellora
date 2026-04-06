import type { BrowserAutomationPort } from "../../ports/browser-automation.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type { EventBus } from "../../ports/event-bus.js";
import type { OpportunityRepository } from "../../ports/opportunity-repository.js";
import type { SourceListingRepository } from "../../ports/source-listing-repository.js";
import type { WorkflowRunRepository } from "../../ports/workflow-run-repository.js";
import { createDraftEnrichment } from "../../modules/ai/catalog-enrichment-policy.js";
import { scoreOpportunity } from "../../modules/opportunities/opportunity-scoring.js";
import { createIdempotencyKey } from "../../modules/events/idempotency.js";

export interface DiscoveryOrchestratorInput {
  sellerId: string;
  sourceUrl: string;
  extractionProfile: string;
  targetLocale: string;
  targetCurrency: string;
  sellerCategoryFit?: number;
}

export class DiscoveryOrchestrator {
  constructor(
    private readonly browserAutomation: BrowserAutomationPort,
    private readonly sourceListingRepository: SourceListingRepository,
    private readonly opportunityRepository: OpportunityRepository,
    private readonly workflowRunRepository: WorkflowRunRepository,
    private readonly eventBus: EventBus
  ) {}

  async discover(input: DiscoveryOrchestratorInput) {
    const workflowRun = await this.workflowRunRepository.create({
      sellerId: input.sellerId,
      kind: "discovery_loop",
      status: "in_progress",
      subjectType: "source_url",
      subjectId: input.sourceUrl,
      currentStep: "extract"
    });

    const extraction = await this.browserAutomation.extract({
      sourceUrl: input.sourceUrl,
      extractionProfile: input.extractionProfile
    });

    const enrichment = createDraftEnrichment({
      sourcePlatform: "approved_web_source",
      sourceTitle: extraction.title ?? "Untitled source listing",
      sourceDescription: undefined,
      sourceAttributes: extraction.attributes as KeyValueRecord,
      targetLocale: input.targetLocale,
      targetCurrency: input.targetCurrency
    });

    const sourceListing = await this.sourceListingRepository.create({
      sellerId: input.sellerId,
      sourceType: "approved_web_source",
      sourceUrl: input.sourceUrl,
      sourceTitle: extraction.title ?? "Untitled source listing",
      sourceCurrency: extraction.currency,
      rawPayload: extraction.attributes,
      normalizedPayload: enrichment.normalizedAttributes,
      discoveredAt: new Date().toISOString()
    });

    const scoring = scoreOpportunity({
      listing: sourceListing,
      sellerCategoryFit: input.sellerCategoryFit
    });

    const opportunity = await this.opportunityRepository.create({
      sellerId: input.sellerId,
      sourceListingId: sourceListing.id,
      status: "scored",
      estimatedSellPriceMinor: scoring.estimatedCostMinor + scoring.estimatedMarginMinor,
      estimatedCostMinor: scoring.estimatedCostMinor,
      estimatedMarginMinor: scoring.estimatedMarginMinor,
      estimatedMarginPct: scoring.estimatedMarginPct,
      opportunityScore: scoring.opportunityScore,
      riskScore: scoring.riskScore,
      fitScore: scoring.fitScore,
      localizationScore: scoring.localizationScore,
      rankingReasons: scoring.rankingReasons,
      aiDraft: {
        cleanedTitle: enrichment.cleanedTitle,
        localizedTitle: enrichment.localizedTitle ?? null,
        localizedDescription: enrichment.localizedDescription ?? null,
        normalizedAttributes: enrichment.normalizedAttributes,
        merchandisingHighlights: enrichment.merchandisingHighlights,
        reviewFlags: enrichment.reviewFlags
      }
    });

    await this.workflowRunRepository.updateProgress(
      workflowRun.id,
      "completed",
      "persisted_discovery"
    );

    await this.eventBus.publish({
      id: createIdempotencyKey(["discovery_completed", input.sellerId, sourceListing.id]),
      aggregateType: "source_listing",
      aggregateId: sourceListing.id,
      eventType: "discovery_completed",
      occurredAt: new Date().toISOString(),
      idempotencyKey: createIdempotencyKey(["discovery_completed", input.sellerId, sourceListing.id]),
      payload: {
        sellerId: input.sellerId,
        sourceListingId: sourceListing.id,
        opportunityId: opportunity.id,
        sourceUrl: input.sourceUrl,
        cleanedTitle: enrichment.cleanedTitle,
        opportunityScore: scoring.opportunityScore
      }
    });

    return {
      workflowRun,
      sourceListing,
      opportunity,
      extraction,
      enrichment,
      scoring
    };
  }
}
