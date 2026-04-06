import type {
  WorkflowEngine,
  WorkflowSignalRequest,
  WorkflowStartRequest
} from "../../ports/workflow-engine.js";

export interface TemporalWorkflowEngineOptions {
  namespace: string;
}

export class TemporalWorkflowEngine implements WorkflowEngine {
  constructor(private readonly options: TemporalWorkflowEngineOptions) {}

  async start(request: WorkflowStartRequest): Promise<void> {
    void request;
    void this.options;
    throw new Error("TemporalWorkflowEngine is not wired yet");
  }

  async signal(request: WorkflowSignalRequest): Promise<void> {
    void request;
    void this.options;
    throw new Error("TemporalWorkflowEngine is not wired yet");
  }
}
