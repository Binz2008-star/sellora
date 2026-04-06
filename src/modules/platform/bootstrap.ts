import { loadConfig, type AppConfig } from "../../core/config.js";
import { CategoryTemplateRegistry } from "../catalog/category-template-registry.js";
import { summarizeLegacyIntake } from "../migration/legacy-intake.js";

export interface PlatformBootstrapSnapshot {
  config: AppConfig;
  categoryTemplateKeys: string[];
  legacyIntakeCounts: {
    copyAndAdapt: number;
    referenceOnly: number;
    rewrite: number;
  };
}

export function createPlatformBootstrapSnapshot(): PlatformBootstrapSnapshot {
  const config = loadConfig();
  const categoryTemplates = new CategoryTemplateRegistry().list();
  const intake = summarizeLegacyIntake();

  return {
    config,
    categoryTemplateKeys: categoryTemplates.map((template) => template.key),
    legacyIntakeCounts: {
      copyAndAdapt: intake.copyAndAdapt.length,
      referenceOnly: intake.referenceOnly.length,
      rewrite: intake.rewrite.length
    }
  };
}
