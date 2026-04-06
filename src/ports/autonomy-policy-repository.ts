import type { AutonomyPolicy } from "../domain/autonomy/policy.js";

export interface AutonomyPolicyRepository {
  findEnabledPolicyForSeller(sellerId: string): Promise<AutonomyPolicy | null>;
}
