import type { AuditStamp, EntityId, Money } from "../shared/types.js";

export type QuoteStatus =
  | "draft"
  | "sent"
  | "approved"
  | "rejected"
  | "expired"
  | "converted";

export interface Quote extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  customerId: EntityId;
  quoteNumber: string;
  status: QuoteStatus;
  subtotal: Money;
  discount?: Money;
  total: Money;
  expiresAt?: string;
  notes?: string;
}

export interface QuoteLine {
  id: EntityId;
  quoteId: EntityId;
  productId?: EntityId;
  titleSnapshot: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}
