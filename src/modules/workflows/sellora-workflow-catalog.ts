import type { WorkflowBlueprint } from "../autonomy/workflow-blueprints.js";
import { workflowBlueprints } from "../autonomy/workflow-blueprints.js";

export function getWorkflowBlueprint(kind: WorkflowBlueprint["kind"]): WorkflowBlueprint {
  const workflow = workflowBlueprints.find((candidate) => candidate.kind === kind);

  if (!workflow) {
    throw new Error(`Unknown workflow kind: ${kind}`);
  }

  return workflow;
}
