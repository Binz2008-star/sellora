import type { AuditStamp, EntityId } from "../shared/types.js";

export type AgentRole =
  | "scout"
  | "analyst"
  | "merchandiser"
  | "inventory"
  | "sales"
  | "ops"
  | "fulfillment";

export type AgentJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentPolicy {
  role: AgentRole;
  enabled: boolean;
  maxRiskScore: number;
  minimumMarginPct?: number;
  autoPublish?: boolean;
  allowedSourceTypes: string[];
  minimumLocalizationScore?: number;
}

export interface AgentJob extends AuditStamp {
  id: EntityId;
  sellerId: EntityId;
  role: AgentRole;
  status: AgentJobStatus;
  subjectType: string;
  subjectId: EntityId;
  retryCount: number;
  lastError?: string;
}
