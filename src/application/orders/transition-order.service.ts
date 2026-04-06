import type { InventoryLifecycleAction, OrderLifecycleRepository } from "../../ports/order-lifecycle-repository.js";
import type { EventBus } from "../../ports/event-bus.js";
import type { OrderStatus } from "../../domain/orders/order.js";
import { OrderStateMachine } from "../../modules/orders/order-state-machine.js";
import { createIdempotencyKey } from "../../modules/events/idempotency.js";
import type { EventEnvelope } from "../../domain/events/event-envelope.js";
import type { RepositoryTransaction } from "../../ports/repository-transaction.js";

const TERMINAL_RELEASE_STATUSES: OrderStatus[] = ["cancelled", "expired"];

export interface TransitionOrderInput {
  orderId: string;
  nextStatus: OrderStatus;
  reason?: string;
  fulfillment?: {
    bookingReference?: string;
    courierName?: string;
    trackingNumber?: string;
  };
}

export interface TransitionOrderOptions {
  transaction?: RepositoryTransaction;
  publishExternalEvents?: boolean;
}

export interface TransitionOrderResult {
  order: Awaited<ReturnType<OrderLifecycleRepository["applyTransition"]>>["order"];
  inventoryMovements: Awaited<ReturnType<OrderLifecycleRepository["applyTransition"]>>["inventoryMovements"];
  fulfillmentRecord?: Awaited<ReturnType<OrderLifecycleRepository["applyTransition"]>>["fulfillmentRecord"];
  pendingExternalEvents: EventEnvelope[];
}

function buildInventoryActions(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  lines: Array<{
    productOfferingId: string;
    quantity: number;
    titleSnapshot: string;
    inventoryMode: "stocked" | "unique-item" | "service";
  }>
): InventoryLifecycleAction[] {
  const inventoryLines = lines.filter((line) => line.inventoryMode !== "service");

  if (TERMINAL_RELEASE_STATUSES.includes(nextStatus)) {
    return inventoryLines.map((line) => ({
      type: "release",
      productOfferingId: line.productOfferingId,
      quantity: line.quantity,
      titleSnapshot: line.titleSnapshot
    }));
  }

  if (currentStatus === "packing" && nextStatus === "shipped") {
    return inventoryLines.map((line) => ({
      type: "release_and_deduct",
      productOfferingId: line.productOfferingId,
      quantity: line.quantity,
      titleSnapshot: line.titleSnapshot
    }));
  }

  return [];
}

function buildFulfillmentUpdate(
  nextStatus: OrderStatus,
  fulfillment?: TransitionOrderInput["fulfillment"]
) {
  if (nextStatus === "shipped") {
    return {
      status: "shipped" as const,
      bookingReference: fulfillment?.bookingReference,
      courierName: fulfillment?.courierName,
      trackingNumber: fulfillment?.trackingNumber,
      handedOffAt: new Date().toISOString()
    };
  }

  if (nextStatus === "delivered") {
    return {
      status: "delivered" as const,
      bookingReference: fulfillment?.bookingReference,
      courierName: fulfillment?.courierName,
      trackingNumber: fulfillment?.trackingNumber,
      deliveredAt: new Date().toISOString()
    };
  }

  return undefined;
}

export class TransitionOrderService {
  constructor(
    private readonly orderLifecycleRepository: OrderLifecycleRepository,
    private readonly eventBus: EventBus,
    private readonly orderStateMachine = new OrderStateMachine()
  ) {}

  async transition(
    input: TransitionOrderInput,
    options: TransitionOrderOptions = {}
  ): Promise<TransitionOrderResult> {
    const context = await this.orderLifecycleRepository.getTransitionContext(
      input.orderId,
      options.transaction
    );

    if (!context) {
      throw new Error(`Order not found: ${input.orderId}`);
    }

    const transition = this.orderStateMachine.transition({
      order: context.order,
      nextStatus: input.nextStatus,
      reason: input.reason
    });

    const inventoryActions = buildInventoryActions(
      context.order.status,
      input.nextStatus,
      context.lines
    );

    const fulfillmentUpdate = buildFulfillmentUpdate(input.nextStatus, input.fulfillment);

    const result = await this.orderLifecycleRepository.applyTransition(
      {
        orderId: context.order.id,
        expectedCurrentStatus: context.order.status,
        nextStatus: input.nextStatus,
        reason: input.reason,
        inventoryActions,
        fulfillmentUpdate
      },
      options.transaction
    );

    const pendingExternalEvents: EventEnvelope[] = [{
      id: createIdempotencyKey(["order_status_changed", result.order.id, input.nextStatus]),
      aggregateType: "order",
      aggregateId: result.order.id,
      eventType: "order_status_changed",
      occurredAt: result.order.updatedAt,
      idempotencyKey: createIdempotencyKey(["order_status_changed", result.order.id, input.nextStatus]),
      payload: {
        from: transition.previousStatus,
        to: transition.nextStatus,
        reason: transition.reason ?? "unspecified"
      }
    }];

    for (const movement of result.inventoryMovements) {
      pendingExternalEvents.push({
        id: createIdempotencyKey(["inventory_lifecycle", movement.id]),
        aggregateType: "inventory_movement",
        aggregateId: movement.id,
        eventType: `inventory_${movement.type}`,
        occurredAt: movement.occurredAt,
        idempotencyKey: createIdempotencyKey(["inventory_lifecycle", movement.id]),
        payload: {
          sellerId: movement.sellerId,
          productOfferingId: movement.productOfferingId,
          quantity: movement.quantity,
          referenceType: movement.referenceType ?? "order",
          referenceId: movement.referenceId ?? result.order.id
        }
      });
    }

    if (result.fulfillmentRecord) {
      pendingExternalEvents.push({
        id: createIdempotencyKey([
          "fulfillment_status_changed",
          result.fulfillmentRecord.id,
          result.fulfillmentRecord.status
        ]),
        aggregateType: "fulfillment",
        aggregateId: result.fulfillmentRecord.id,
        eventType: "fulfillment_status_changed",
        occurredAt: result.fulfillmentRecord.updatedAt,
        idempotencyKey: createIdempotencyKey([
          "fulfillment_status_changed",
          result.fulfillmentRecord.id,
          result.fulfillmentRecord.status
        ]),
        payload: {
          orderId: result.fulfillmentRecord.orderId,
          status: result.fulfillmentRecord.status,
          trackingNumber: result.fulfillmentRecord.trackingNumber ?? null,
          courierName: result.fulfillmentRecord.courierName ?? null
        }
      });
    }

    if (options.publishExternalEvents !== false) {
      for (const event of pendingExternalEvents) {
        await this.eventBus.publish(event);
      }
    }

    return {
      ...result,
      pendingExternalEvents
    };
  }
}
