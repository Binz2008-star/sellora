import { describe, expect, it } from "vitest";
import { RunShipmentReconciliationPollingService } from "../../src/application/fulfillment/run-shipment-reconciliation-polling.service.js";
import type {
  ListEligibleShipmentsInput,
  ShipmentPollingCandidate,
  ShipmentReconciliationPollingRepository
} from "../../src/ports/shipment-reconciliation-polling-repository.js";

class FakeShipmentPollingRepository implements ShipmentReconciliationPollingRepository {
  calls: ListEligibleShipmentsInput[] = [];

  constructor(private readonly candidates: ShipmentPollingCandidate[]) {}

  async listEligibleShipments(
    input: ListEligibleShipmentsInput
  ): Promise<ShipmentPollingCandidate[]> {
    this.calls.push(input);
    return this.candidates;
  }
}

class FakeReconcileShipmentStatusService {
  calls: Array<{ orderId: string }> = [];
  failures = new Map<string, string>();
  duplicates = new Set<string>();
  delivered = new Set<string>();

  async execute(input: { orderId: string }) {
    this.calls.push(input);

    const failure = this.failures.get(input.orderId);
    if (failure) {
      throw new Error(failure);
    }

    return {
      duplicate: this.duplicates.has(input.orderId),
      deliveredHandoff: this.delivered.has(input.orderId),
      noChange: this.duplicates.has(input.orderId) || !this.delivered.has(input.orderId)
    };
  }
}

function makeCandidate(
  orderId: string,
  overrides: Partial<ShipmentPollingCandidate> = {}
): ShipmentPollingCandidate {
  return {
    orderId,
    sellerId: "seller_1",
    fulfillmentRecordId: `${orderId}_fulfillment`,
    bookingReference: `${orderId}_booking`,
    trackingNumber: `${orderId}_tracking`,
    status: "shipped",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
    ...overrides
  };
}

describe("RunShipmentReconciliationPollingService", () => {
  it("selects eligible shipments using batch size, lookback, and webhook backoff window", async () => {
    const repository = new FakeShipmentPollingRepository([makeCandidate("order_1")]);
    const reconcileService = new FakeReconcileShipmentStatusService();
    const service = new RunShipmentReconciliationPollingService(repository, reconcileService);

    await service.execute({
      batchSize: 25,
      lookbackDays: 3,
      minWebhookAgeMinutes: 20,
      now: "2026-04-06T12:00:00.000Z"
    });

    expect(repository.calls).toEqual([
      {
        limit: 25,
        eligibleBefore: "2026-04-06T11:40:00.000Z",
        createdAfter: "2026-04-03T12:00:00.000Z"
      }
    ]);
  });

  it("skips candidates without tracking identity and keeps terminal shipments out of the batch contract", async () => {
    const repository = new FakeShipmentPollingRepository([
      makeCandidate("order_1", {
        bookingReference: undefined,
        trackingNumber: undefined
      })
    ]);
    const reconcileService = new FakeReconcileShipmentStatusService();
    const service = new RunShipmentReconciliationPollingService(repository, reconcileService);

    const result = await service.execute({
      batchSize: 10,
      lookbackDays: 2,
      minWebhookAgeMinutes: 15,
      now: "2026-04-06T12:00:00.000Z"
    });

    expect(reconcileService.calls).toHaveLength(0);
    expect(result.items).toEqual([
      {
        orderId: "order_1",
        duplicate: true,
        deliveredHandoff: false,
        noChange: true,
        error: "missing_tracking_identity"
      }
    ]);
  });

  it("preserves idempotency by reusing the reconciliation authority result", async () => {
    const repository = new FakeShipmentPollingRepository([
      makeCandidate("order_1"),
      makeCandidate("order_2")
    ]);
    const reconcileService = new FakeReconcileShipmentStatusService();
    reconcileService.duplicates.add("order_1");
    reconcileService.delivered.add("order_2");
    const service = new RunShipmentReconciliationPollingService(repository, reconcileService);

    const result = await service.execute({
      batchSize: 10,
      lookbackDays: 2,
      minWebhookAgeMinutes: 15,
      now: "2026-04-06T12:00:00.000Z"
    });

    expect(result.items).toEqual([
      {
        orderId: "order_1",
        duplicate: true,
        deliveredHandoff: false,
        noChange: true
      },
      {
        orderId: "order_2",
        duplicate: false,
        deliveredHandoff: true,
        noChange: false
      }
    ]);
  });

  it("isolates batch failures so one shipment does not crash the whole polling run", async () => {
    const repository = new FakeShipmentPollingRepository([
      makeCandidate("order_1"),
      makeCandidate("order_2"),
      makeCandidate("order_3")
    ]);
    const reconcileService = new FakeReconcileShipmentStatusService();
    reconcileService.failures.set("order_2", "provider timeout");
    reconcileService.delivered.add("order_3");
    const service = new RunShipmentReconciliationPollingService(repository, reconcileService);

    const result = await service.execute({
      batchSize: 10,
      lookbackDays: 2,
      minWebhookAgeMinutes: 15,
      now: "2026-04-06T12:00:00.000Z"
    });

    expect(reconcileService.calls).toEqual([
      { orderId: "order_1" },
      { orderId: "order_2" },
      { orderId: "order_3" }
    ]);
    expect(result.failures).toBe(1);
    expect(result.items[1]).toEqual({
      orderId: "order_2",
      duplicate: false,
      deliveredHandoff: false,
      noChange: false,
      error: "provider timeout"
    });
    expect(result.items[2]).toEqual({
      orderId: "order_3",
      duplicate: false,
      deliveredHandoff: true,
      noChange: false
    });
  });
});
