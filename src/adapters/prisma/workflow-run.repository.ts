import { WorkflowRunStatus as PrismaWorkflowRunStatus } from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type {
  CreateWorkflowRunInput,
  WorkflowRunRepository
} from "../../ports/workflow-run-repository.js";
import { mapWorkflowRun } from "./mappers.js";

function toPrismaWorkflowStatus(status: string): string {
  return status.toUpperCase();
}

export class PrismaWorkflowRunRepository implements WorkflowRunRepository {
  async create(input: CreateWorkflowRunInput) {
    const record = await prisma.workflowRun.create({
      data: {
        sellerId: input.sellerId,
        kind: input.kind,
        status: toPrismaWorkflowStatus(input.status) as PrismaWorkflowRunStatus,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        currentStep: input.currentStep,
        lastEventAt: input.lastEventAt ? new Date(input.lastEventAt) : undefined
      }
    });

    return mapWorkflowRun(record);
  }

  async updateProgress(workflowRunId: string, status: CreateWorkflowRunInput["status"], currentStep: string) {
    const record = await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        status: toPrismaWorkflowStatus(status) as PrismaWorkflowRunStatus,
        currentStep,
        lastEventAt: new Date()
      }
    });

    return mapWorkflowRun(record);
  }
}
