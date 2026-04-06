import type { AuditStamp, EntityId } from "../shared/types.js";

export type WorkflowKind =
  | "discovery_loop"
  | "listing_publish"
  | "sales_conversation"
  | "quote_to_order"
  | "order_fulfillment"
  | "delivery_follow_up";

export type WorkflowStatus =
  | "pending"
  | "in_progress"
  | "waiting_event"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowRun extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  kind: WorkflowKind;
  status: WorkflowStatus;
  subjectType: string;
  subjectId: EntityId;
  currentStep: string;
  lastEventAt?: string;
}
