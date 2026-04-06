import type { EventBus } from "../../ports/event-bus.js";
import type {
  CreateOrderInput,
  CreateOrderResult,
  OrderCheckoutRepository
} from "../../ports/order-checkout-repository.js";
import { createIdempotencyKey } from "../../modules/events/idempotency.js";

export interface CreateSelloraOrderInput extends Omit<CreateOrderInput, "orderNumber" | "lines"> {
  lines: Array<{
    productOfferingId: string;
    quantity: number;
  }>;
}

function buildOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = now.getTime().toString(36).toUpperCase();
  return `SOR-${datePart}-${suffix}`;
}

function normalizeLines(input: CreateSelloraOrderInput["lines"]): CreateOrderInput["lines"] {
  const aggregated = new Map<string, number>();

  for (const line of input) {
    if (!line.productOfferingId) {
      throw new Error("productOfferingId is required");
    }

    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Invalid quantity for offering ${line.productOfferingId}`);
    }

    aggregated.set(
      line.productOfferingId,
      (aggregated.get(line.productOfferingId) ?? 0) + line.quantity
    );
  }

  return Array.from(aggregated.entries()).map(([productOfferingId, quantity]) => ({
    productOfferingId,
    quantity
  }));
}

export class CreateOrderService {
  constructor(
    private readonly orderCheckoutRepository: OrderCheckoutRepository,
    private readonly eventBus: EventBus
  ) {}

  async create(input: CreateSelloraOrderInput): Promise<CreateOrderResult> {
    if (input.lines.length === 0) {
      throw new Error("At least one order line is required");
    }

    const result = await this.orderCheckoutRepository.createOrder({
      sellerId: input.sellerId,
      orderNumber: buildOrderNumber(),
      mode: input.mode,
      paymentPolicy: input.paymentPolicy,
      notes: input.notes,
      customer: input.customer,
      lines: normalizeLines(input.lines)
    });

    await this.eventBus.publish({
      id: createIdempotencyKey(["order_created", result.order.id]),
      aggregateType: "order",
      aggregateId: result.order.id,
      eventType: "order_created",
      occurredAt: result.order.createdAt,
      idempotencyKey: createIdempotencyKey(["order_created", result.order.id]),
      payload: {
        sellerId: result.order.sellerId,
        customerId: result.order.customerId,
        orderNumber: result.order.orderNumber,
        status: result.order.status,
        paymentStatus: result.order.paymentStatus,
        totalMinor: result.order.total.amountMinor,
        currency: result.order.total.currency,
        lineCount: result.lines.length
      }
    });

    for (const movement of result.inventoryMovements) {
      await this.eventBus.publish({
        id: createIdempotencyKey(["inventory_reserved", movement.id]),
        aggregateType: "inventory_movement",
        aggregateId: movement.id,
        eventType: "inventory_reserved",
        occurredAt: movement.occurredAt,
        idempotencyKey: createIdempotencyKey(["inventory_reserved", movement.id]),
        payload: {
          sellerId: movement.sellerId,
          productOfferingId: movement.productOfferingId,
          quantity: movement.quantity,
          referenceType: movement.referenceType ?? "order",
          referenceId: movement.referenceId ?? result.order.id
        }
      });
    }

    return result;
  }
}
