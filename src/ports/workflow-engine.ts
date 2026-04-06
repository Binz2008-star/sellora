export interface WorkflowStartRequest {
  workflowName: string;
  workflowId: string;
  input: Record<string, unknown>;
}

export interface WorkflowSignalRequest {
  workflowId: string;
  signalName: string;
  payload: Record<string, unknown>;
}

export interface WorkflowEngine {
  start(request: WorkflowStartRequest): Promise<void>;
  signal(request: WorkflowSignalRequest): Promise<void>;
}
