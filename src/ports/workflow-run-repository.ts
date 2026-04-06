import type { WorkflowRun } from "../domain/autonomy/workflow.js";

export interface CreateWorkflowRunInput {
  sellerId: string;
  kind: WorkflowRun["kind"];
  status: WorkflowRun["status"];
  subjectType: string;
  subjectId: string;
  currentStep: string;
  lastEventAt?: string;
}

export interface WorkflowRunRepository {
  create(input: CreateWorkflowRunInput): Promise<WorkflowRun>;
  updateProgress(workflowRunId: string, status: WorkflowRun["status"], currentStep: string): Promise<WorkflowRun>;
}
