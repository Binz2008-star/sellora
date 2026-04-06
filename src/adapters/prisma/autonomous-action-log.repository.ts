import { AutonomousActionDecision as PrismaAutonomousActionDecision, Prisma } from "@prisma/client";
import { prisma } from "../../core/db/prisma.js";
import type {
  AutonomousActionLogRepository,
  CreateAutonomousActionLogInput
} from "../../ports/autonomous-action-log-repository.js";
import { mapAutonomousAction } from "./mappers.js";

function toPrismaDecision(decision: string): string {
  return decision.toUpperCase();
}

export class PrismaAutonomousActionLogRepository implements AutonomousActionLogRepository {
  async create(input: CreateAutonomousActionLogInput) {
    const record = await prisma.autonomousActionLog.create({
      data: {
        sellerId: input.sellerId,
        role: input.role,
        actionType: input.type,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        decision: toPrismaDecision(input.decision) as PrismaAutonomousActionDecision,
        reasonCodesJson: input.reasonCodes,
        metadataJson: input.metadata as Prisma.InputJsonValue
      }
    });

    return mapAutonomousAction(record);
  }
}
