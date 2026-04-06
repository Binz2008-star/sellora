import {
  canTransitionOrder,
  type Order,
  type OrderStatus
} from "../../domain/orders/order.js";

export interface TransitionRequest {
  order: Order;
  nextStatus: OrderStatus;
  reason?: string;
}

export interface TransitionResult {
  orderId: string;
  previousStatus: OrderStatus;
  nextStatus: OrderStatus;
  reason?: string;
}

export class OrderStateMachine {
  transition(request: TransitionRequest): TransitionResult {
    const { order, nextStatus, reason } = request;

    if (!canTransitionOrder(order.status, nextStatus)) {
      throw new Error(`Invalid order transition: ${order.status} -> ${nextStatus}`);
    }

    return {
      orderId: order.id,
      previousStatus: order.status,
      nextStatus,
      reason
    };
  }
}
