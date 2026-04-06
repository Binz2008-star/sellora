import type { AutonomousAction } from "../domain/autonomy/action.js";
import type { AgentRole } from "../domain/autonomy/agent-runtime.js";

export interface CreateAutonomousActionLogInput {
  sellerId: string;
  role: AgentRole;
  type: AutonomousAction["type"];
  subjectType: string;
  subjectId: string;
  decision: AutonomousAction["decision"];
  reasonCodes: string[];
  metadata: Record<string, unknown>;
}

export interface AutonomousActionLogRepository {
  create(input: CreateAutonomousActionLogInput): Promise<AutonomousAction>;
}
