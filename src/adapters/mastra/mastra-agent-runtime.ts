import type { AgentRole } from "../../domain/autonomy/agent-runtime.js";

export interface MastraAgentRuntimeOptions {
  enabledRoles: AgentRole[];
}

export class MastraAgentRuntime {
  constructor(private readonly options: MastraAgentRuntimeOptions) {}

  getEnabledRoles(): AgentRole[] {
    return this.options.enabledRoles;
  }
}
