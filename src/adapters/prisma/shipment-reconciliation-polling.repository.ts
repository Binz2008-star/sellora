import { prisma } from "../../core/db/prisma.js";
import type {
  ListEligibleShipmentsInput,
  ShipmentPollingCandidate,
  ShipmentReconciliationPollingRepository
} from "../../ports/shipment-reconciliation-polling-repository.js";

type FulfillmentRecordRow = {
  id: string;
  sellerId: string;
  orderId: string;
  status: string;
  bookingReference: string | null;
  trackingNumber: string | null;
  providerStatus: string | null;
  createdAt: Date;
  lastWebhookAt: Date | null;
  updatedAt: Date;
};

function mapCandidate(row: FulfillmentRecordRow): ShipmentPollingCandidate {
  return {
    orderId: row.orderId,
    sellerId: row.sellerId,
    fulfillmentRecordId: row.id,
    bookingReference: row.bookingReference ?? undefined,
    trackingNumber: row.trackingNumber ?? undefined,
    providerStatus: row.providerStatus ?? undefined,
    status: "shipped",
    createdAt: row.createdAt.toISOString(),
    lastWebhookAt: row.lastWebhookAt?.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export class PrismaShipmentReconciliationPollingRepository
  implements ShipmentReconciliationPollingRepository
{
  async listEligibleShipments(
    input: ListEligibleShipmentsInput
  ): Promise<ShipmentPollingCandidate[]> {
    const records = await prisma.fulfillmentRecord.findMany({
      where: {
        status: "SHIPPED",
        createdAt: {
          gte: new Date(input.createdAfter)
        },
        OR: [
          { lastWebhookAt: null },
          {
            lastWebhookAt: {
              lte: new Date(input.eligibleBefore)
            }
          }
        ],
        NOT: {
          providerStatus: {
            in: ["delivered", "returned", "cancelled", "failed"]
          }
        }
      },
      orderBy: [
        { lastWebhookAt: "asc" },
        { updatedAt: "asc" }
      ],
      take: input.limit
    });

    return (records as unknown as FulfillmentRecordRow[]).map(mapCandidate);
  }
}
