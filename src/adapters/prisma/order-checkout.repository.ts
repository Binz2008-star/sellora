import {
  OrderMode as PrismaOrderMode,
  OrderStatus as PrismaOrderStatus,
  PaymentPolicy as PrismaPaymentPolicy,
  Prisma
} from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type { InventoryMovement, ProductOffering } from "../../domain/catalog/product.js";
import type { Order, OrderLine } from "../../domain/orders/order.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import { deriveInventoryPosition } from "../../modules/orders/inventory-ledger.js";
import type {
  CreateOrderCustomerInput,
  CreateOrderInput,
  CreateOrderResult,
  OrderCheckoutRepository
} from "../../ports/order-checkout-repository.js";

type OfferingRecord = {
  id: string;
  sellerId: string;
  productId: string;
  sku: string;
  inventoryMode: string;
  currency: string;
  priceMinor: number;
  costPriceMinor: number;
  depositMinor: number | null;
  isActive: boolean;
  sourceListingId: string | null;
  selectedAttributesJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    title: string;
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
};

function inventoryModeFromPrisma(value: string): ProductOffering["inventoryMode"] {
  return value.toLowerCase().replace("_", "-") as ProductOffering["inventoryMode"];
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
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapOrderLine(record: OrderLineRecord): OrderLine {
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
    }
  };
}

function determineInitialOrderStatus(input: CreateOrderInput): PrismaOrderStatus {
  if (input.mode === "reservation") {
    return "RESERVED";
  }

  if (input.paymentPolicy === "manual-invoice") {
    return "DRAFT";
  }

  return "PENDING_PAYMENT";
}

async function upsertCustomer(
  tx: Prisma.TransactionClient,
  sellerId: string,
  customer: CreateOrderCustomerInput
) {
  const existing = await tx.customer.findFirst({
    where: {
      sellerId,
      phone: customer.phone
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (existing) {
    return tx.customer.update({
      where: { id: existing.id },
      data: {
        name: customer.name,
        email: customer.email,
        addressText: customer.addressText,
        city: customer.city
      }
    });
  }

  return tx.customer.create({
    data: {
      sellerId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      addressText: customer.addressText,
      city: customer.city
    }
  });
}

export class PrismaOrderCheckoutRepository implements OrderCheckoutRepository {
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const run = async (tx: Prisma.TransactionClient) => {
      const offerings = await tx.productOffering.findMany({
        where: {
          sellerId: input.sellerId,
          id: {
            in: input.lines.map((line) => line.productOfferingId)
          },
          isActive: true
        },
        include: {
          product: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      if (offerings.length !== input.lines.length) {
        throw new Error("One or more product offerings are invalid or inactive");
      }

      const offeringMap = new Map(offerings.map((offering) => [offering.id, offering]));

      const inventoryMovements = await tx.inventoryMovement.findMany({
        where: {
          sellerId: input.sellerId,
          productOfferingId: {
            in: input.lines.map((line) => line.productOfferingId)
          }
        },
        orderBy: {
          occurredAt: "asc"
        }
      });

      const movementMap = new Map<string, InventoryMovementRecord[]>();
      for (const movement of inventoryMovements) {
        const current = movementMap.get(movement.productOfferingId) ?? [];
        current.push(movement as InventoryMovementRecord);
        movementMap.set(movement.productOfferingId, current);
      }

      let currency: string | undefined;
      let subtotalMinor = 0;

      for (const line of input.lines) {
        const offering = offeringMap.get(line.productOfferingId) as OfferingRecord | undefined;
        if (!offering) {
          throw new Error(`Offering not found: ${line.productOfferingId}`);
        }

        if (currency && currency !== offering.currency) {
          throw new Error("Order lines must share the same currency");
        }

        currency = offering.currency;

        if (offering.inventoryMode === "UNIQUE_ITEM" && line.quantity !== 1) {
          throw new Error(`Unique-item offering ${offering.sku} can only be ordered once`);
        }

        if (offering.inventoryMode !== "SERVICE") {
          const existingMovements = (movementMap.get(offering.id) ?? []).map(mapInventoryMovement);
          const position = deriveInventoryPosition(existingMovements);

          if (position.available < line.quantity) {
            throw new Error(`Insufficient inventory for offering ${offering.sku}`);
          }
        }

        subtotalMinor += offering.priceMinor * line.quantity;
      }

      if (!currency) {
        throw new Error("Unable to determine order currency");
      }

      const customer = await upsertCustomer(tx, input.sellerId, input.customer);
      const initialStatus = determineInitialOrderStatus(input);

      const orderRecord = await tx.order.create({
        data: {
          sellerId: input.sellerId,
          customerId: customer.id,
          orderNumber: input.orderNumber,
          mode: input.mode.toUpperCase().replace("-", "_") as PrismaOrderMode,
          status: initialStatus,
          paymentPolicy: input.paymentPolicy.toUpperCase().replace(/-/g, "_") as PrismaPaymentPolicy,
          paymentStatus: "PENDING",
          subtotalMinor,
          deliveryFeeMinor: 0,
          totalMinor: subtotalMinor,
          currency,
          reservationExpiresAt:
            input.mode === "reservation"
              ? new Date(Date.now() + 1000 * 60 * 30)
              : null,
          notes: input.notes
        }
      });

      const lineRecords: OrderLineRecord[] = [];
      const reserveMovements: InventoryMovementRecord[] = [];

      for (const line of input.lines) {
        const offering = offeringMap.get(line.productOfferingId) as OfferingRecord;

        const lineRecord = await tx.orderLine.create({
          data: {
            orderId: orderRecord.id,
            productId: offering.product.id,
            productOfferingId: offering.id,
            titleSnapshot: offering.product.title,
            quantity: line.quantity,
            unitPriceMinor: offering.priceMinor,
            costPriceMinor: offering.costPriceMinor,
            currencySnapshot: offering.currency,
            selectedAttributesSnapshot: offering.selectedAttributesJson as Prisma.InputJsonValue,
            lineTotalMinor: offering.priceMinor * line.quantity
          }
        });

        lineRecords.push(lineRecord as OrderLineRecord);

        if (inventoryModeFromPrisma(offering.inventoryMode) !== "service") {
          const movement = await tx.inventoryMovement.create({
            data: {
              sellerId: input.sellerId,
              productOfferingId: offering.id,
              type: "RESERVE",
              quantity: line.quantity,
              referenceType: "order",
              referenceId: orderRecord.id,
              notes: "Inventory reserved during authoritative order creation"
            }
          });

          reserveMovements.push(movement as InventoryMovementRecord);

          await tx.orderEvent.create({
            data: {
              orderId: orderRecord.id,
              eventType: "inventory_reserved",
              payloadJson: {
                productOfferingId: offering.id,
                sku: offering.sku,
                quantity: line.quantity
              } as Prisma.InputJsonValue
            }
          });
        }
      }

      await tx.orderEvent.create({
        data: {
          orderId: orderRecord.id,
          eventType: "order_created",
          payloadJson: {
            mode: orderRecord.mode,
            status: orderRecord.status,
            paymentPolicy: orderRecord.paymentPolicy,
            totalMinor: orderRecord.totalMinor,
            currency: orderRecord.currency
          } as Prisma.InputJsonValue
        }
      });

      return {
        order: mapOrder(orderRecord as OrderRecord),
        lines: lineRecords.map(mapOrderLine),
        inventoryMovements: reserveMovements.map(mapInventoryMovement)
      };
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await prisma.$transaction(run, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });
      } catch (error) {
        const isSerializationFailure =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";

        if (!isSerializationFailure || attempt === 2) {
          throw error;
        }
      }
    }

    throw new Error("Order creation failed after serialization retries");
  }
}
