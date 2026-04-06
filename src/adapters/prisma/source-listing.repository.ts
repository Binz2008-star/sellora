import { Prisma } from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type {
  CreateSourceListingInput,
  SourceListingRepository
} from "../../ports/source-listing-repository.js";
import { mapSourceListing } from "./mappers.js";

export class PrismaSourceListingRepository implements SourceListingRepository {
  async create(input: CreateSourceListingInput) {
    const record = await prisma.sourceListing.create({
      data: {
        sellerId: input.sellerId,
        supplierSourceId: input.supplierSourceId,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        externalListingId: input.externalListingId,
        sourceTitle: input.sourceTitle,
        sourcePriceMinor: input.sourcePriceMinor,
        sourceCurrency: input.sourceCurrency,
        rawPayloadJson: input.rawPayload as Prisma.InputJsonValue,
        normalizedJson: input.normalizedPayload as Prisma.InputJsonValue,
        discoveredAt: new Date(input.discoveredAt)
      }
    });

    return mapSourceListing(record);
  }
}
