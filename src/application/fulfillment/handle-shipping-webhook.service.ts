import type { ConfirmOrderDeliveryService } from "../orders/confirm-order-delivery.service.js";
import type { FulfillmentRepository } from "../../ports/fulfillment-repository.js";
import type { ShippingWebhookRepository } from "../../ports/shipping-webhook-repository.js";
import type { EventBus } from "../../ports/event-bus.js";
import type { NormalizedShippingWebhook } from "../../adapters/karrio/karrio-webhook-ingress.js";

export interface HandleShippingWebhookResult {
  duplicate: boolean;
  deliveredHandoff: boolean;
}

export class HandleShippingWebhookService {
  constructor(
    private readonly shippingWebhookRepository: ShippingWebhookRepository,
    private readonly fulfillmentRepository: FulfillmentRepository,
    private readonly confirmOrderDeliveryService: ConfirmOrderDeliveryService,
    private readonly eventBus?: EventBus
  ) {}

  async execute(webhook: NormalizedShippingWebhook): Promise<HandleShippingWebhookResult> {
    const transactionResult = await this.shippingWebhookRepository.withTransaction(async (transaction) => {
      const context = await this.fulfillmentRepository.findWebhookContext(
        {
          providerReference: webhook.providerReference,
          trackingNumber: webhook.trackingNumber
        },
        transaction
      );

      const receipt = await this.shippingWebhookRepository.recordReceipt(
        {
          sellerId: context?.order.sellerId,
          provider: webhook.provider,
          eventType: webhook.eventType,
          idempotencyKey: webhook.idempotencyKey,
          providerReference: webhook.providerReference,
          trackingNumber: webhook.trackingNumber,
          normalizedStatus: webhook.normalizedStatus,
          orderId: context?.order.id,
          rawPayload: webhook.rawPayload,
          receivedAt: webhook.receivedAt
        },
        transaction
      );

      if (receipt.duplicate) {
        return {
          duplicate: true,
          deliveredHandoff: false,
          pendingExternalEvents: []
        };
      }

      if (!context) {
        return {
          duplicate: false,
          deliveredHandoff: false,
          pendingExternalEvents: []
        };
      }

      await this.fulfillmentRepository.updateProviderStatus(
        {
          fulfillmentRecordId: context.fulfillmentRecord.id,
          providerStatus: webhook.normalizedStatus,
          providerReference: webhook.providerReference,
          trackingNumber: webhook.trackingNumber,
          trackingUrl: context.fulfillmentRecord.trackingUrl,
          courierName: context.fulfillmentRecord.courierName,
          rawPayload: webhook.rawPayload,
          receivedAt: webhook.receivedAt
        },
        transaction
      );

      if (webhook.normalizedStatus !== "delivered") {
        return {
          duplicate: false,
          deliveredHandoff: false,
          pendingExternalEvents: []
        };
      }

      const delivery = await this.confirmOrderDeliveryService.execute(
        {
          orderId: context.order.id
        },
        {
          transaction,
          publishExternalEvents: false
        }
      );

      return {
        duplicate: false,
        deliveredHandoff: !delivery.duplicateConfirmation,
        pendingExternalEvents: delivery.transition?.pendingExternalEvents ?? []
      };
    });

    if (this.eventBus) {
      for (const event of transactionResult.pendingExternalEvents) {
        await this.eventBus.publish(event);
      }
    }

    return {
      duplicate: transactionResult.duplicate,
      deliveredHandoff: transactionResult.deliveredHandoff
    };
  }
}
