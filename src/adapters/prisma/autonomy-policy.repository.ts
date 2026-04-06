import { prisma } from "../../core/db/prisma.js";
import type { AutonomyPolicyRepository } from "../../ports/autonomy-policy-repository.js";
import { mapAutonomyPolicy } from "./mappers.js";

export class PrismaAutonomyPolicyRepository implements AutonomyPolicyRepository {
  async findEnabledPolicyForSeller(sellerId: string) {
    const record = await prisma.sellerAutonomyPolicy.findFirst({
      where: {
        sellerId,
        enabled: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return record ? mapAutonomyPolicy(record) : null;
  }
}
