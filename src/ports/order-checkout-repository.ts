import type { InventoryMovement } from "../domain/catalog/product.js";
import type {
  Order,
  OrderLine,
  OrderMode,
  PaymentPolicy
} from "../domain/orders/order.js";

export interface CreateOrderCustomerInput {
  name: string;
  phone: string;
  email?: string;
  addressText?: string;
  city?: string;
}

export interface CreateOrderLineInput {
  productOfferingId: string;
  quantity: number;
}

export interface CreateOrderInput {
  sellerId: string;
  orderNumber: string;
  mode: OrderMode;
  paymentPolicy: PaymentPolicy;
  notes?: string;
  customer: CreateOrderCustomerInput;
  lines: CreateOrderLineInput[];
}

export interface CreateOrderResult {
  order: Order;
  lines: OrderLine[];
  inventoryMovements: InventoryMovement[];
}

export interface OrderCheckoutRepository {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
}
