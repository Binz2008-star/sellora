import type { AuditStamp, EntityId, Money } from "../shared/types.js";

export type OrderMode = "reservation" | "standard" | "quote-conversion";
export type PaymentPolicy = "full-upfront" | "deposit-then-balance" | "manual-invoice";

export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "reserved"
  | "confirmed"
  | "packing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "expired";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded";

export interface Order extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  customerId: EntityId;
  orderNumber: string;
  mode: OrderMode;
  paymentPolicy: PaymentPolicy;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: Money;
  deliveryFee?: Money;
  total: Money;
  reservationExpiresAt?: string;
  notes?: string;
}

export interface OrderLine {
  id: EntityId;
  orderId: EntityId;
  productId: EntityId;
  productOfferingId: EntityId;
  titleSnapshot: string;
  quantity: number;
  unitPrice: Money;
  costPrice: Money;
  currencySnapshot: string;
  selectedAttributesSnapshot: Record<string, unknown>;
  lineTotal: Money;
}

export interface FulfillmentRecord extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  orderId: EntityId;
  status: "not_ready" | "ready_to_ship" | "shipped" | "delivered" | "returned";
  bookingReference?: string;
  courierName?: string;
  trackingNumber?: string;
  handedOffAt?: string;
  deliveredAt?: string;
}

export interface AllowedTransition {
  from: OrderStatus;
  to: OrderStatus[];
}

export const ORDER_TRANSITIONS: AllowedTransition[] = [
  { from: "draft", to: ["pending_payment", "cancelled"] },
  { from: "pending_payment", to: ["reserved", "confirmed", "cancelled", "expired"] },
  { from: "reserved", to: ["confirmed", "cancelled", "expired"] },
  { from: "confirmed", to: ["packing", "cancelled", "refunded"] },
  { from: "packing", to: ["shipped", "cancelled"] },
  { from: "shipped", to: ["delivered", "refunded"] },
  { from: "delivered", to: ["refunded"] },
  { from: "cancelled", to: [] },
  { from: "refunded", to: [] },
  { from: "expired", to: [] }
];

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS.some((transition) => transition.from === from && transition.to.includes(to));
}
