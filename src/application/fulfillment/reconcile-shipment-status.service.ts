import {
  normalizeKarrioShipmentStatusSnapshot
} from "../../adapters/karrio/karrio-webhook-ingress.js";
import type { FulfillmentRepository } from "../../ports/fulfillment-repository.js";
import type { ShippingGateway } from "../../ports/shipping-gateway.js";
import type { HandleShippingWebhookService } from "./handle-shipping-webhook.service.js";

export interface ReconcileShipmentStatusInput {
  orderId: string;
}

export interface ReconcileShipmentStatusResult {
  duplicate: boolean;
  deliveredHandoff: boolean;
  noChange: boolean;
}

export class ReconcileShipmentStatusService {
  constructor(
    private readonly fulfillmentRepository: FulfillmentRepository,
    private readonly shippingGateway: ShippingGateway,
    private readonly handleShippingWebhookService: Pick<HandleShippingWebhookService, "execute">
  ) {}

  async execute(
    input: ReconcileShipmentStatusInput
  ): Promise<ReconcileShipmentStatusResult> {
    const context = await this.fulfillmentRepository.getDeliveryContext(input.orderId);

    if (!context) {
      throw new Error(`Order not found: ${input.orderId}`);
    }

    if (
      context.order.status === "delivered" &&
      context.fulfillmentRecord?.status === "delivered" &&
      context.fulfillmentRecord.providerStatus === "delivered"
    ) {
      return {
        duplicate: true,
        deliveredHandoff: false,
        noChange: true
      };
    }

    if (!context.fulfillmentRecord) {
      throw new Error(`Order ${input.orderId} has no fulfillment record to reconcile`);
    }

    const snapshot = await this.shippingGateway.getShipmentStatus({
      bookingReference: context.fulfillmentRecord.bookingReference,
      trackingNumber: context.fulfillmentRecord.trackingNumber
    });

    if (!snapshot.success) {
      throw new Error(snapshot.failureMessage ?? "Shipment reconciliation failed");
    }

    const webhook = normalizeKarrioShipmentStatusSnapshot(snapshot);
    const result = await this.handleShippingWebhookService.execute(webhook);

    return {
      duplicate: result.duplicate,
      deliveredHandoff: result.deliveredHandoff,
      noChange: result.duplicate || !result.deliveredHandoff
    };
  }
}
