import {
  OrderStatus as PrismaOrderStatus,
  ShipmentStatus as PrismaShipmentStatus,
  Prisma
} from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type { InventoryMovement } from "../../domain/catalog/product.js";
import type { FulfillmentRecord, Order, OrderLine } from "../../domain/orders/order.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type {
  ApplyOrderTransitionInput,
  ApplyOrderTransitionResult,
  FulfillmentLifecycleUpdate,
  OrderLifecycleRepository,
  OrderTransitionContext,
  TransitionContextLine
} from "../../ports/order-lifecycle-repository.js";
import type { RepositoryTransaction } from "../../ports/repository-transaction.js";

type OrderRecord = {
  id: string;
  sellerId: string;
  customerId: string;
  orderNumber: string;
  mode: string;
  status: string;
  paymentPolicy: string;
  paymentStatus: string;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  currency: string;
  reservationExpiresAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrderLineRecord = {
  id: string;
  orderId: string;
  productId: string;
  productOfferingId: string;
  titleSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  costPriceMinor: number;
  currencySnapshot: string;
  selectedAttributesSnapshot: unknown;
  lineTotalMinor: number;
  createdAt: Date;
  productOffering: {
    inventoryMode: string;
  };
};

type InventoryMovementRecord = {
  id: string;
  sellerId: string;
  productOfferingId: string;
  type: string;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type FulfillmentRecordRow = {
  id: string;
  sellerId: string;
  orderId: string;
  status: string;
  bookingReference: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  rawPayloadJson: unknown;
  handedOffAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CurrentFulfillmentRecord = {
  bookingReference: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  rawPayloadJson: Prisma.JsonValue | null;
  handedOffAt: Date | null;
  deliveredAt: Date | null;
};

function mapOrder(record: OrderRecord): Order {
  return {
    id: record.id,
    sellerId: record.sellerId,
    customerId: record.customerId,
    orderNumber: record.orderNumber,
    mode: record.mode.toLowerCase().replace("_", "-") as Order["mode"],
    paymentPolicy: record.paymentPolicy.toLowerCase().replace(/_/g, "-") as Order["paymentPolicy"],
    status: record.status.toLowerCase() as Order["status"],
    paymentStatus: record.paymentStatus.toLowerCase() as Order["paymentStatus"],
    subtotal: {
      amountMinor: record.subtotalMinor,
      currency: record.currency
    },
    deliveryFee:
      record.deliveryFeeMinor > 0
        ? {
            amountMinor: record.deliveryFeeMinor,
            currency: record.currency
          }
        : undefined,
    total: {
      amountMinor: record.totalMinor,
      currency: record.currency
    },
    reservationExpiresAt: record.reservationExpiresAt?.toISOString(),
    notes: record.notes ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapOrderLine(record: OrderLineRecord): TransitionContextLine {
  return {
    id: record.id,
    orderId: record.orderId,
    productId: record.productId,
    productOfferingId: record.productOfferingId,
    titleSnapshot: record.titleSnapshot,
    quantity: record.quantity,
    unitPrice: {
      amountMinor: record.unitPriceMinor,
      currency: record.currencySnapshot
    },
    costPrice: {
      amountMinor: record.costPriceMinor,
      currency: record.currencySnapshot
    },
    currencySnapshot: record.currencySnapshot,
    selectedAttributesSnapshot:
      ((record.selectedAttributesSnapshot as Record<string, unknown>) ?? {}) as KeyValueRecord,
    lineTotal: {
      amountMinor: record.lineTotalMinor,
      currency: record.currencySnapshot
    },
    inventoryMode: record.productOffering.inventoryMode.toLowerCase().replace("_", "-") as TransitionContextLine["inventoryMode"]
  };
}

function mapInventoryMovement(record: InventoryMovementRecord): InventoryMovement {
  return {
    id: record.id,
    sellerId: record.sellerId,
    productOfferingId: record.productOfferingId,
    type: record.type.toLowerCase() as InventoryMovement["type"],
    quantity: record.quantity,
    referenceType: record.referenceType ?? undefined,
    referenceId: record.referenceId ?? undefined,
    notes: record.notes ?? undefined,
    occurredAt: record.occurredAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapFulfillmentRecord(record: FulfillmentRecordRow): FulfillmentRecord {
  return {
    id: record.id,
    sellerId: record.sellerId,
    orderId: record.orderId,
    status: record.status.toLowerCase() as FulfillmentRecord["status"],
    bookingReference: record.bookingReference ?? undefined,
    courierName: record.courierName ?? undefined,
    trackingNumber: record.trackingNumber ?? undefined,
    trackingUrl: record.trackingUrl ?? undefined,
    rawPayload:
      ((record.rawPayloadJson as KeyValueRecord | null) ?? undefined) as
        | KeyValueRecord
        | undefined,
    handedOffAt: record.handedOffAt?.toISOString(),
    deliveredAt: record.deliveredAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toShipmentStatus(status: FulfillmentLifecycleUpdate["status"]): PrismaShipmentStatus {
  return status.toUpperCase() as PrismaShipmentStatus;
}

async function createLifecycleEvent(
  tx: Prisma.TransactionClient,
  orderId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  await tx.orderEvent.create({
    data: {
      orderId,
      eventType,
      payloadJson: payload as Prisma.InputJsonValue
    }
  });
}

export class PrismaOrderLifecycleRepository implements OrderLifecycleRepository {
  async getTransitionContext(
    orderId: string,
    transaction?: RepositoryTransaction
  ): Promise<OrderTransitionContext | null> {
    const client = (transaction as Prisma.TransactionClient | undefined) ?? prisma;
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            productOffering: {
              select: {
                inventoryMode: true
              }
            }
          }
        },
        fulfillmentRecord: true
      }
    });

    if (!order) {
      return null;
    }

    return {
      order: mapOrder(order as unknown as OrderRecord),
      lines: order.lines.map((line) => mapOrderLine(line as unknown as OrderLineRecord)),
      fulfillmentRecord: order.fulfillmentRecord
        ? mapFulfillmentRecord(order.fulfillmentRecord as unknown as FulfillmentRecordRow)
        : undefined
    };
  }

  async applyTransition(
    input: ApplyOrderTransitionInput,
    transaction?: RepositoryTransaction
  ): Promise<ApplyOrderTransitionResult> {
    const run = async (tx: Prisma.TransactionClient) => {
      const current = await tx.order.findUnique({
        where: { id: input.orderId },
        include: {
          fulfillmentRecord: true
        }
      });

      if (!current) {
        throw new Error(`Order not found: ${input.orderId}`);
      }

      if (current.status !== input.expectedCurrentStatus.toUpperCase()) {
        throw new Error(
          `Order status mismatch: expected ${input.expectedCurrentStatus}, actual ${current.status.toLowerCase()}`
        );
      }

      const updatedOrder = await tx.order.update({
        where: { id: input.orderId },
        data: {
          status: input.nextStatus.toUpperCase() as PrismaOrderStatus,
          updatedAt: new Date()
        }
      });

      await createLifecycleEvent(tx, input.orderId, "order_status_changed", {
        from: input.expectedCurrentStatus,
        to: input.nextStatus,
        reason: input.reason ?? "unspecified"
      });

      const createdMovements: InventoryMovementRecord[] = [];

      for (const action of input.inventoryActions) {
        if (action.type === "release") {
          const releaseMovement = await tx.inventoryMovement.create({
            data: {
              sellerId: updatedOrder.sellerId,
              productOfferingId: action.productOfferingId,
              type: "RELEASE",
              quantity: action.quantity,
              referenceType: "order",
              referenceId: updatedOrder.id,
              notes: `Inventory released for order ${input.nextStatus}`
            }
          });

          createdMovements.push(releaseMovement as unknown as InventoryMovementRecord);

          await createLifecycleEvent(tx, updatedOrder.id, "inventory_released", {
            productOfferingId: action.productOfferingId,
            quantity: action.quantity,
            titleSnapshot: action.titleSnapshot,
            reason: input.nextStatus
          });

          continue;
        }

        const releaseMovement = await tx.inventoryMovement.create({
          data: {
            sellerId: updatedOrder.sellerId,
            productOfferingId: action.productOfferingId,
            type: "RELEASE",
            quantity: action.quantity,
            referenceType: "order",
            referenceId: updatedOrder.id,
            notes: "Inventory released before stock deduction on shipment"
          }
        });

        const deductMovement = await tx.inventoryMovement.create({
          data: {
            sellerId: updatedOrder.sellerId,
            productOfferingId: action.productOfferingId,
            type: "DEDUCT",
            quantity: action.quantity,
            referenceType: "order",
            referenceId: updatedOrder.id,
            notes: "Inventory deducted on shipment"
          }
        });

        createdMovements.push(releaseMovement as unknown as InventoryMovementRecord);
        createdMovements.push(deductMovement as unknown as InventoryMovementRecord);

        await createLifecycleEvent(tx, updatedOrder.id, "inventory_deducted", {
          productOfferingId: action.productOfferingId,
          quantity: action.quantity,
          titleSnapshot: action.titleSnapshot,
          reason: input.nextStatus
        });
      }

      let fulfillmentRecord: FulfillmentRecordRow | null = null;

      if (input.fulfillmentUpdate) {
        const existing = current.fulfillmentRecord as CurrentFulfillmentRecord | null;
        const data = {
          sellerId: updatedOrder.sellerId,
          status: toShipmentStatus(input.fulfillmentUpdate.status),
          bookingReference:
            input.fulfillmentUpdate.bookingReference ?? existing?.bookingReference ?? null,
          courierName:
            input.fulfillmentUpdate.courierName ?? existing?.courierName ?? null,
          trackingNumber:
            input.fulfillmentUpdate.trackingNumber ?? existing?.trackingNumber ?? null,
          trackingUrl:
            input.fulfillmentUpdate.trackingUrl ?? existing?.trackingUrl ?? null,
          rawPayloadJson:
            (input.fulfillmentUpdate.rawPayload ?? existing?.rawPayloadJson ?? undefined) as
              | Prisma.InputJsonValue
              | undefined,
          handedOffAt:
            input.fulfillmentUpdate.handedOffAt
              ? new Date(input.fulfillmentUpdate.handedOffAt)
              : existing?.handedOffAt ?? null,
          deliveredAt:
            input.fulfillmentUpdate.deliveredAt
              ? new Date(input.fulfillmentUpdate.deliveredAt)
              : existing?.deliveredAt ?? null
        };

        fulfillmentRecord = existing
          ? (await tx.fulfillmentRecord.update({
              where: { orderId: updatedOrder.id },
              data
            })) as unknown as FulfillmentRecordRow
          : (await tx.fulfillmentRecord.create({
              data: {
                orderId: updatedOrder.id,
                ...data
              }
            })) as unknown as FulfillmentRecordRow;

        await createLifecycleEvent(tx, updatedOrder.id, "fulfillment_status_changed", {
          status: input.fulfillmentUpdate.status,
          trackingNumber: data.trackingNumber,
          trackingUrl: data.trackingUrl,
          courierName: data.courierName
        });
      }

      return {
        order: mapOrder(updatedOrder as unknown as OrderRecord),
        inventoryMovements: createdMovements.map(mapInventoryMovement),
        fulfillmentRecord: fulfillmentRecord ? mapFulfillmentRecord(fulfillmentRecord) : undefined
      };
    };

    if (transaction) {
      return run(transaction as Prisma.TransactionClient);
    }

    return prisma.$transaction(run);
  }
}
