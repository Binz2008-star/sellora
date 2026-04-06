import {
  LEGACY_COPY_PLAN,
  type LegacySource
} from "../../domain/migration/legacy-copy-plan.js";

export interface LegacyIntakeSummary {
  copyAndAdapt: LegacySource[];
  referenceOnly: LegacySource[];
  rewrite: LegacySource[];
}

export function summarizeLegacyIntake(): LegacyIntakeSummary {
  return {
    copyAndAdapt: LEGACY_COPY_PLAN.filter((item) => item.decision === "copy-and-adapt"),
    referenceOnly: LEGACY_COPY_PLAN.filter((item) => item.decision === "reference-only"),
    rewrite: LEGACY_COPY_PLAN.filter((item) => item.decision === "rewrite")
  };
}
