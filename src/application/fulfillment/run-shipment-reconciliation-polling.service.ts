import type {
  ShipmentPollingCandidate,
  ShipmentReconciliationPollingRepository
} from "../../ports/shipment-reconciliation-polling-repository.js";
import type { ReconcileShipmentStatusService } from "./reconcile-shipment-status.service.js";

export interface RunShipmentReconciliationPollingInput {
  batchSize: number;
  lookbackDays: number;
  minWebhookAgeMinutes: number;
  now?: string;
}

export interface ShipmentPollingRunItemResult {
  orderId: string;
  duplicate: boolean;
  deliveredHandoff: boolean;
  noChange: boolean;
  error?: string;
}

export interface RunShipmentReconciliationPollingResult {
  scanned: number;
  processed: number;
  failures: number;
  items: ShipmentPollingRunItemResult[];
}

function subtractMinutes(isoDate: string, minutes: number): string {
  return new Date(Date.parse(isoDate) - minutes * 60 * 1000).toISOString();
}

function subtractDays(isoDate: string, days: number): string {
  return new Date(Date.parse(isoDate) - days * 24 * 60 * 60 * 1000).toISOString();
}

function isEligibleCandidate(candidate: ShipmentPollingCandidate): boolean {
  return Boolean(candidate.bookingReference || candidate.trackingNumber);
}

export class RunShipmentReconciliationPollingService {
  constructor(
    private readonly pollingRepository: ShipmentReconciliationPollingRepository,
    private readonly reconcileShipmentStatusService: Pick<ReconcileShipmentStatusService, "execute">
  ) {}

  async execute(
    input: RunShipmentReconciliationPollingInput
  ): Promise<RunShipmentReconciliationPollingResult> {
    const now = input.now ?? new Date().toISOString();
    const candidates = await this.pollingRepository.listEligibleShipments({
      limit: input.batchSize,
      eligibleBefore: subtractMinutes(now, input.minWebhookAgeMinutes),
      createdAfter: subtractDays(now, input.lookbackDays)
    });

    const items: ShipmentPollingRunItemResult[] = [];

    for (const candidate of candidates) {
      if (!isEligibleCandidate(candidate)) {
        items.push({
          orderId: candidate.orderId,
          duplicate: true,
          deliveredHandoff: false,
          noChange: true,
          error: "missing_tracking_identity"
        });
        continue;
      }

      try {
        const result = await this.reconcileShipmentStatusService.execute({
          orderId: candidate.orderId
        });

        items.push({
          orderId: candidate.orderId,
          duplicate: result.duplicate,
          deliveredHandoff: result.deliveredHandoff,
          noChange: result.noChange
        });
      } catch (error) {
        items.push({
          orderId: candidate.orderId,
          duplicate: false,
          deliveredHandoff: false,
          noChange: false,
          error: error instanceof Error ? error.message : "unknown_error"
        });
      }
    }

    return {
      scanned: candidates.length,
      processed: items.filter((item) => !item.error || item.error === "missing_tracking_identity").length,
      failures: items.filter((item) => item.error && item.error !== "missing_tracking_identity").length,
      items
    };
  }
}
