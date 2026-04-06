import { OpportunityStatus as PrismaOpportunityStatus, Prisma } from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type {
  CreateOpportunityInput,
  OpportunityRepository
} from "../../ports/opportunity-repository.js";
import { mapOpportunity } from "./mappers.js";

function toPrismaStatus(status: string): string {
  return status.toUpperCase();
}

export class PrismaOpportunityRepository implements OpportunityRepository {
  async create(input: CreateOpportunityInput) {
    const record = await prisma.opportunity.create({
      data: {
        sellerId: input.sellerId,
        sourceListingId: input.sourceListingId,
        status: toPrismaStatus(input.status) as PrismaOpportunityStatus,
        categoryKey: input.categoryKey,
        estimatedSellPriceMinor: input.estimatedSellPriceMinor,
        estimatedCostMinor: input.estimatedCostMinor,
        estimatedShippingMinor: input.estimatedShippingMinor,
        estimatedMarginMinor: input.estimatedMarginMinor,
        estimatedMarginPct: input.estimatedMarginPct,
        opportunityScore: input.opportunityScore,
        riskScore: input.riskScore,
        fitScore: input.fitScore,
        localizationScore: input.localizationScore,
        rankingReasonsJson: input.rankingReasons ?? [],
        aiDraftJson: (input.aiDraft ?? {}) as Prisma.InputJsonValue,
        reviewNotes: input.reviewNotes
      }
    });

    return mapOpportunity(record);
  }

  async updateStatus(opportunityId: string, status: CreateOpportunityInput["status"], reviewNotes?: string) {
    const record = await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        status: toPrismaStatus(status) as PrismaOpportunityStatus,
        reviewNotes
      }
    });

    return mapOpportunity(record);
  }
}
