import { PaymentStatus as PrismaPaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type { Order } from "../../domain/orders/order.js";
import type { PaymentAttempt, PaymentEventType } from "../../domain/payments/payment.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type {
  CreatePaymentAttemptInput,
  PaymentAttemptContext,
  PaymentRepository,
  UpdatePaymentAttemptStatusInput
} from "../../ports/payment-repository.js";
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

type PaymentAttemptRecord = {
  id: string;
  sellerId: string;
  orderId: string;
  provider: string;
  providerReference: string | null;
  idempotencyKey: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  metadataJson: unknown;
  rawPayloadJson: unknown;
  createdAt: Date;
  updatedAt: Date;
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

function mapPaymentAttempt(record: PaymentAttemptRecord): PaymentAttempt {
  return {
    id: record.id,
    sellerId: record.sellerId,
    orderId: record.orderId,
    provider: record.provider,
    providerReference: record.providerReference ?? undefined,
    idempotencyKey: record.idempotencyKey ?? undefined,
    status: record.status.toLowerCase() as PaymentAttempt["status"],
    amount: {
      amountMinor: record.amountMinor,
      currency: record.currency
    },
    metadata:
      ((record.metadataJson as Record<string, unknown> | null) ?? undefined) as KeyValueRecord | undefined,
    rawPayload:
      ((record.rawPayloadJson as Record<string, unknown> | null) ?? undefined) as KeyValueRecord | undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function mapPaymentStatusToOrderPaymentStatus(status: PaymentAttempt["status"]): PrismaPaymentStatus {
  switch (status) {
    case "pending":
      return "PENDING";
    case "processing":
      return "PROCESSING";
    case "paid":
      return "PAID";
    case "failed":
      return "FAILED";
    case "refunded":
      return "REFUNDED";
  }
}

function buildEventPayload(
  record: PaymentAttemptRecord,
  eventType: PaymentEventType,
  providerReference?: string,
  metadata?: KeyValueRecord
) {
  return {
    provider: record.provider,
    providerReference: providerReference ?? record.providerReference ?? null,
    amountMinor: record.amountMinor,
    currency: record.currency,
    status: record.status.toLowerCase(),
    ...(metadata ?? {}),
    eventType
  } as Prisma.InputJsonValue;
}

export class PrismaPaymentRepository implements PaymentRepository {
  async withTransaction<T>(work: (transaction: RepositoryTransaction) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => work(tx));
  }

  async findAttemptContextById(
    paymentAttemptId: string,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext | null> {
    const client = (transaction as Prisma.TransactionClient | undefined) ?? prisma;
    const record = await client.paymentAttempt.findUnique({
      where: { id: paymentAttemptId },
      include: {
        order: true
      }
    });

    if (!record) {
      return null;
    }

    return {
      attempt: mapPaymentAttempt(record as unknown as PaymentAttemptRecord),
      order: mapOrder(record.order as unknown as OrderRecord)
    };
  }

  async findAttemptContextByIdempotencyKey(
    sellerId: string,
    idempotencyKey: string,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext | null> {
    const client = (transaction as Prisma.TransactionClient | undefined) ?? prisma;
    const record = await client.paymentAttempt.findFirst({
      where: {
        sellerId,
        idempotencyKey
      },
      include: {
        order: true
      }
    });

    if (!record) {
      return null;
    }

    return {
      attempt: mapPaymentAttempt(record as unknown as PaymentAttemptRecord),
      order: mapOrder(record.order as unknown as OrderRecord)
    };
  }

  async findAttemptContextByProviderReference(
    provider: string,
    providerReference: string,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext | null> {
    const client = (transaction as Prisma.TransactionClient | undefined) ?? prisma;
    const record = await client.paymentAttempt.findFirst({
      where: {
        provider,
        providerReference
      },
      include: {
        order: true
      }
    });

    if (!record) {
      return null;
    }

    return {
      attempt: mapPaymentAttempt(record as unknown as PaymentAttemptRecord),
      order: mapOrder(record.order as unknown as OrderRecord)
    };
  }

  async findActiveAttemptForOrder(
    orderId: string,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext | null> {
    const client = (transaction as Prisma.TransactionClient | undefined) ?? prisma;
    const record = await client.paymentAttempt.findFirst({
      where: {
        orderId,
        status: {
          in: ["PENDING", "PROCESSING"]
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        order: true
      }
    });

    if (!record) {
      return null;
    }

    return {
      attempt: mapPaymentAttempt(record as unknown as PaymentAttemptRecord),
      order: mapOrder(record.order as unknown as OrderRecord)
    };
  }

  async createAttempt(
    input: CreatePaymentAttemptInput,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext> {
    const run = async (tx: Prisma.TransactionClient) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId }
      });

      if (!order) {
        throw new Error(`Order not found: ${input.orderId}`);
      }

      const attempt = await tx.paymentAttempt.create({
        data: {
          sellerId: input.sellerId,
          orderId: input.orderId,
          provider: input.provider,
          idempotencyKey: input.idempotencyKey,
          amountMinor: input.amountMinor,
          currency: input.currency,
          status: "PENDING",
          metadataJson: (input.metadata ?? {}) as Prisma.InputJsonValue,
          rawPayloadJson: input.rawPayload as Prisma.InputJsonValue | undefined
        }
      });

      await tx.orderEvent.create({
        data: {
          orderId: input.orderId,
          eventType: "payment_initiated",
          payloadJson: {
            provider: input.provider,
            amountMinor: input.amountMinor,
            currency: input.currency,
            idempotencyKey: input.idempotencyKey ?? null
          } as Prisma.InputJsonValue
        }
      });

      return {
        attempt: mapPaymentAttempt(attempt as unknown as PaymentAttemptRecord),
        order: mapOrder(order as unknown as OrderRecord)
      };
    };

    if (transaction) {
      return run(transaction as Prisma.TransactionClient);
    }

    return prisma.$transaction(run);
  }

  async updateAttemptStatus(
    input: UpdatePaymentAttemptStatusInput,
    transaction?: RepositoryTransaction
  ): Promise<PaymentAttemptContext> {
    const run = async (tx: Prisma.TransactionClient) => {
      const current = await tx.paymentAttempt.findUnique({
        where: { id: input.paymentAttemptId },
        include: {
          order: true
        }
      });

      if (!current) {
        throw new Error(`Payment attempt not found: ${input.paymentAttemptId}`);
      }

      if (current.status !== input.expectedCurrentStatus.toUpperCase()) {
        throw new Error(
          `Payment status mismatch: expected ${input.expectedCurrentStatus}, actual ${current.status.toLowerCase()}`
        );
      }

      const updatedAttempt = await tx.paymentAttempt.update({
        where: { id: input.paymentAttemptId },
        data: {
          status: input.nextStatus.toUpperCase() as PrismaPaymentStatus,
          providerReference: input.providerReference ?? current.providerReference,
          metadataJson: (input.metadata ?? current.metadataJson ?? {}) as Prisma.InputJsonValue,
          rawPayloadJson:
            (input.rawPayload ?? current.rawPayloadJson ?? undefined) as
              | Prisma.InputJsonValue
              | undefined
        }
      });

      const updatedOrder = await tx.order.update({
        where: { id: current.orderId },
        data: {
          paymentStatus: mapPaymentStatusToOrderPaymentStatus(input.nextStatus)
        }
      });

      await tx.orderEvent.create({
        data: {
          orderId: current.orderId,
          eventType: input.eventType,
          payloadJson: buildEventPayload(
            {
              ...(updatedAttempt as unknown as PaymentAttemptRecord),
              orderId: current.orderId
            },
            input.eventType,
            input.providerReference,
            input.metadata
          )
        }
      });

      return {
        attempt: mapPaymentAttempt(updatedAttempt as unknown as PaymentAttemptRecord),
        order: mapOrder(updatedOrder as unknown as OrderRecord)
      };
    };

    if (transaction) {
      return run(transaction as Prisma.TransactionClient);
    }

    return prisma.$transaction(run);
  }
}
