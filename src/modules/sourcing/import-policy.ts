import type { ImportJobStatus, SupplierPlatform } from "../../domain/sourcing/product-source.js";

export function canAutoPublishFromPlatform(platform: SupplierPlatform): boolean {
  void platform;
  return false;
}

export function nextImportStatusAfterEnrichment(currentStatus: ImportJobStatus): ImportJobStatus {
  if (currentStatus === "fetched" || currentStatus === "enriched") {
    return "review_required";
  }

  return currentStatus;
}
