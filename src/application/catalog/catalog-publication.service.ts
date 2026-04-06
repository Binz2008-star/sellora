import type { CatalogPublicationRepository } from "../../ports/catalog-publication-repository.js";
import type { OpportunityRepository } from "../../ports/opportunity-repository.js";
import type { EventBus } from "../../ports/event-bus.js";
import { createIdempotencyKey } from "../../modules/events/idempotency.js";
import type { Opportunity, SourceListing } from "../../domain/opportunities/opportunity.js";

export interface PublishOpportunityToCatalogInput {
  sellerId: string;
  sourceListing: SourceListing;
  opportunity: Opportunity;
}

function buildSku(sourceListing: SourceListing): string {
  const titlePrefix = sourceListing.sourceTitle
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
  const sourceSuffix = sourceListing.id.slice(-6).toUpperCase();

  return `${titlePrefix || "SELLORA"}-${sourceSuffix}`;
}

export class CatalogPublicationService {
  constructor(
    private readonly catalogPublicationRepository: CatalogPublicationRepository,
    private readonly opportunityRepository: OpportunityRepository,
    private readonly eventBus: EventBus
  ) {}

  async publish(input: PublishOpportunityToCatalogInput) {
    const aiDraft = input.opportunity.aiDraft ?? {};
    const normalizedAttributes = (aiDraft.normalizedAttributes ?? {}) as Record<string, unknown>;

    const publication = await this.catalogPublicationRepository.create({
      sellerId: input.sellerId,
      categoryKey: input.opportunity.categoryKey ?? "phone-resale",
      sourceListingId: input.sourceListing.id,
      title:
        (aiDraft.cleanedTitle as string | undefined) ??
        input.sourceListing.sourceTitle,
      description: (aiDraft.localizedDescription as string | undefined) ?? undefined,
      attributes: normalizedAttributes,
      sku: buildSku(input.sourceListing),
      inventoryMode: "stocked",
      currency:
        input.sourceListing.sourceCurrency ??
        "AED",
      priceMinor: input.opportunity.estimatedSellPriceMinor ?? 0,
      costPriceMinor: input.opportunity.estimatedCostMinor ?? 0,
      initialQuantity: 1,
      selectedAttributes: normalizedAttributes
    });

    const persistedOpportunity = await this.opportunityRepository.updateStatus(
      input.opportunity.id,
      "published",
      "catalog_listing_created"
    );

    await this.eventBus.publish({
      id: createIdempotencyKey([
        "catalog_publication_completed",
        input.sellerId,
        input.opportunity.id
      ]),
      aggregateType: "opportunity",
      aggregateId: input.opportunity.id,
      eventType: "catalog_publication_completed",
      occurredAt: new Date().toISOString(),
      idempotencyKey: createIdempotencyKey([
        "catalog_publication_completed",
        input.sellerId,
        input.opportunity.id
      ]),
      payload: {
        sellerId: input.sellerId,
        opportunityId: persistedOpportunity.id,
        productId: publication.product.id,
        productOfferingId: publication.offering.id,
        inventoryMovementId: publication.initialInventoryMovement?.id ?? ""
      }
    });

    return {
      opportunity: persistedOpportunity,
      publication
    };
  }
}
