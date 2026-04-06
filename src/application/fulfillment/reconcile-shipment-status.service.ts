import {
  normalizeKarrioShipmentStatusSnapshot
} from "../../adapters/karrio/karrio-webhook-ingress.js";
import type { NormalizedShippingWebhook } from "../../adapters/karrio/karrio-webhook-ingress.js";
import type { FulfillmentRepository } from "../../ports/fulfillment-repository.js";
import type { ShippingGateway } from "../../ports/shipping-gateway.js";
import { createIdempotencyKey } from "../../modules/events/idempotency.js";
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

    let snapshot: Awaited<ReturnType<ShippingGateway["getShipmentStatus"]>>;

    try {
      snapshot = await this.shippingGateway.getShipmentStatus({
        bookingReference: context.fulfillmentRecord.bookingReference,
        trackingNumber: context.fulfillmentRecord.trackingNumber
      });
    } catch (error) {
      snapshot = {
        success: false,
        provider: "karrio",
        failureMessage:
          error instanceof Error ? error.message : "Shipment reconciliation failed"
      };
    }

    let webhook: NormalizedShippingWebhook;

    if (snapshot.success) {
      webhook = normalizeKarrioShipmentStatusSnapshot(snapshot);
    } else {
      const fallbackWebhook = this.buildFallbackWebhook(context);
      if (!fallbackWebhook) {
        throw new Error(snapshot.failureMessage ?? "Shipment reconciliation failed");
      }
      webhook = fallbackWebhook;
    }

    const result = await this.handleShippingWebhookService.execute(webhook);

    return {
      duplicate: result.duplicate,
      deliveredHandoff: result.deliveredHandoff,
      noChange: result.duplicate || !result.deliveredHandoff
    };
  }

  private buildFallbackWebhook(
    context: NonNullable<Awaited<ReturnType<FulfillmentRepository["getDeliveryContext"]>>>
  ): NormalizedShippingWebhook | null {
    if (!context.fulfillmentRecord) {
      return null;
    }

    const normalizedStatus =
      context.fulfillmentRecord.providerStatus?.toLowerCase() ??
      context.fulfillmentRecord.status.toLowerCase();

    if (!normalizedStatus || normalizedStatus === "unknown") {
      return null;
    }

    const receivedAt =
      context.fulfillmentRecord.lastWebhookAt ??
      context.fulfillmentRecord.updatedAt ??
      context.fulfillmentRecord.deliveredAt ??
      new Date().toISOString();

    return {
      provider: "karrio",
      eventType: "tracker.reconciled.fallback",
      idempotencyKey: createIdempotencyKey([
        "karrio",
        "tracker.reconciled.fallback",
        context.order.id,
        context.fulfillmentRecord.id,
        normalizedStatus,
        receivedAt
      ]),
      providerReference: context.fulfillmentRecord.bookingReference,
      trackingNumber: context.fulfillmentRecord.trackingNumber,
      normalizedStatus,
      rawPayload: {
        source: "fulfillment_fallback",
        order_id: context.order.id,
        fulfillment_record_id: context.fulfillmentRecord.id,
        booking_reference: context.fulfillmentRecord.bookingReference ?? null,
        tracking_number: context.fulfillmentRecord.trackingNumber ?? null,
        provider_status: context.fulfillmentRecord.providerStatus ?? null,
        fulfillment_status: context.fulfillmentRecord.status
      },
      receivedAt
    };
  }
}
