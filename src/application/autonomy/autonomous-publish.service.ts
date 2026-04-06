import type { Opportunity } from "../../domain/opportunities/opportunity.js";
import type { AutonomyPolicy } from "../../domain/autonomy/policy.js";
import type { AutonomousActionLogRepository } from "../../ports/autonomous-action-log-repository.js";
import type { EventBus } from "../../ports/event-bus.js";
import type { OpportunityRepository } from "../../ports/opportunity-repository.js";
import { createIdempotencyKey } from "../../modules/events/idempotency.js";
import { evaluateAutonomousAction } from "../../modules/autonomy/action-guard.js";

export interface AutonomousPublishDecision {
  allowed: boolean;
  reasonCodes: string[];
  status: Opportunity["status"];
}

export class AutonomousPublishService {
  constructor(
    private readonly opportunityRepository: OpportunityRepository,
    private readonly autonomousActionLogRepository: AutonomousActionLogRepository,
    private readonly eventBus: EventBus
  ) {}

  async decideAndEmit(
    sellerId: string,
    sourceType: string,
    opportunity: Opportunity,
    policy: AutonomyPolicy
  ): Promise<AutonomousPublishDecision> {
    const guard = evaluateAutonomousAction({
      actionType: "publish_listing",
      policy,
      sourceType,
      categoryKey: opportunity.categoryKey,
      opportunity
    });

    const nextStatus: Opportunity["status"] =
      guard.decision === "allowed"
        ? "approved"
        : guard.decision === "manual_only"
          ? "review_required"
          : "rejected";

    const persistedOpportunity = await this.opportunityRepository.updateStatus(
      opportunity.id,
      nextStatus,
      guard.reasonCodes.join(",")
    );

    await this.autonomousActionLogRepository.create({
      sellerId,
      role: "merchandiser",
      type: "publish_listing",
      subjectType: "opportunity",
      subjectId: opportunity.id,
      decision: guard.decision,
      reasonCodes: guard.reasonCodes,
      metadata: {
        sourceType,
        categoryKey: opportunity.categoryKey ?? null,
        estimatedMarginPct: opportunity.estimatedMarginPct ?? null,
        riskScore: opportunity.riskScore ?? null
      }
    });

    await this.eventBus.publish({
      id: createIdempotencyKey([
        "autonomous_publish_decision",
        sellerId,
        opportunity.id,
        guard.decision
      ]),
      aggregateType: "opportunity",
      aggregateId: opportunity.id,
      eventType: "autonomous_publish_decision_made",
      occurredAt: new Date().toISOString(),
      idempotencyKey: createIdempotencyKey([
        "autonomous_publish_decision",
        sellerId,
        opportunity.id
      ]),
      payload: {
        sellerId,
        sourceType,
        decision: guard.decision,
        nextStatus: persistedOpportunity.status,
        reasonCodes: guard.reasonCodes.join(",")
      }
    });

    return {
      allowed: guard.decision === "allowed",
      reasonCodes: guard.reasonCodes,
      status: persistedOpportunity.status
    };
  }
}
