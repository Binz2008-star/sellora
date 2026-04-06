import type { AuditStamp, EntityId, KeyValueRecord } from "../shared/types.js";
import type { AgentRole } from "./agent-runtime.js";

export type AutonomousActionType =
  | "discover_source_listing"
  | "score_opportunity"
  | "publish_listing"
  | "pause_listing"
  | "reprice_listing"
  | "create_quote"
  | "create_order"
  | "issue_invoice"
  | "send_message"
  | "book_shipment"
  | "update_delivery_status";

export type AutonomousActionDecision = "allowed" | "blocked" | "manual_only";

export interface AutonomousAction extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  role: AgentRole;
  type: AutonomousActionType;
  subjectType: string;
  subjectId: EntityId;
  decision: AutonomousActionDecision;
  reasonCodes: string[];
  metadata: KeyValueRecord;
}
