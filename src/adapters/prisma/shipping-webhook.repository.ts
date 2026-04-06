import { Prisma } from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type {
  ShippingWebhookReceiptInput,
  ShippingWebhookReceiptResult,
  ShippingWebhookRepository
} from "../../ports/shipping-webhook-repository.js";
import type { RepositoryTransaction } from "../../ports/repository-transaction.js";

export class PrismaShippingWebhookRepository implements ShippingWebhookRepository {
  async withTransaction<T>(work: (transaction: RepositoryTransaction) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => work(tx));
  }

  async recordReceipt(
    input: ShippingWebhookReceiptInput,
    transaction?: RepositoryTransaction
  ): Promise<ShippingWebhookReceiptResult> {
    const client = (transaction as any) ?? prisma;

    try {
      await client.shippingWebhookReceipt.create({
        data: {
          sellerId: input.sellerId,
          provider: input.provider,
          eventType: input.eventType,
          idempotencyKey: input.idempotencyKey,
          providerReference: input.providerReference,
          trackingNumber: input.trackingNumber,
          normalizedStatus: input.normalizedStatus,
          orderId: input.orderId,
          rawPayloadJson: input.rawPayload,
          receivedAt: new Date(input.receivedAt)
        }
      });

      return {
        duplicate: false
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return {
          duplicate: true
        };
      }

      throw error;
    }
  }
}
