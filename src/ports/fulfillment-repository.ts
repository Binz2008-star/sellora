import type { Order } from "../domain/orders/order.js";

export interface FulfillmentShipmentLine {
  productOfferingId: string;
  titleSnapshot: string;
  quantity: number;
}

export interface FulfillmentShipmentContext {
  order: Order;
  destinationCity?: string;
  lines: FulfillmentShipmentLine[];
}

export interface FulfillmentRepository {
  getShipmentContext(orderId: string): Promise<FulfillmentShipmentContext | null>;
}
