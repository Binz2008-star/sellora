import type { InventoryMode, InventoryMovement } from "../domain/catalog/product.js";
import type {
  FulfillmentRecord,
  Order,
  OrderLine,
  OrderStatus
} from "../domain/orders/order.js";
import type { RepositoryTransaction } from "./repository-transaction.js";

export interface TransitionContextLine extends OrderLine {
  inventoryMode: InventoryMode;
}

export interface OrderTransitionContext {
  order: Order;
  lines: TransitionContextLine[];
  fulfillmentRecord?: FulfillmentRecord;
}

export interface InventoryLifecycleAction {
  type: "release" | "release_and_deduct";
  productOfferingId: string;
  quantity: number;
  titleSnapshot: string;
}

export interface FulfillmentLifecycleUpdate {
  status: "not_ready" | "ready_to_ship" | "shipped" | "delivered" | "returned";
  bookingReference?: string;
  courierName?: string;
  trackingNumber?: string;
  handedOffAt?: string;
  deliveredAt?: string;
}

export interface ApplyOrderTransitionInput {
  orderId: string;
  expectedCurrentStatus: OrderStatus;
  nextStatus: OrderStatus;
  reason?: string;
  inventoryActions: InventoryLifecycleAction[];
  fulfillmentUpdate?: FulfillmentLifecycleUpdate;
}

export interface ApplyOrderTransitionResult {
  order: Order;
  inventoryMovements: InventoryMovement[];
  fulfillmentRecord?: FulfillmentRecord;
}

export interface OrderLifecycleRepository {
  getTransitionContext(
    orderId: string,
    transaction?: RepositoryTransaction
  ): Promise<OrderTransitionContext | null>;
  applyTransition(
    input: ApplyOrderTransitionInput,
    transaction?: RepositoryTransaction
  ): Promise<ApplyOrderTransitionResult>;
}
