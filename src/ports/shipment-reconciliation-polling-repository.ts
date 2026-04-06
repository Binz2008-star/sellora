export interface ShipmentPollingCandidate {
  orderId: string;
  sellerId: string;
  fulfillmentRecordId: string;
  bookingReference?: string;
  trackingNumber?: string;
  providerStatus?: string;
  status: "shipped";
  createdAt: string;
  lastWebhookAt?: string;
  updatedAt: string;
}

export interface ListEligibleShipmentsInput {
  limit: number;
  eligibleBefore: string;
  createdAfter: string;
}

export interface ShipmentReconciliationPollingRepository {
  listEligibleShipments(
    input: ListEligibleShipmentsInput
  ): Promise<ShipmentPollingCandidate[]>;
}
