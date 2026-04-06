import { z } from "zod";
import { handleKarrioWebhookRequest } from "../../application/fulfillment/handle-karrio-webhook.request.js";
import type { BookOrderShipmentService } from "../../application/orders/book-order-shipment.service.js";
import type { ConfirmOrderDeliveryService } from "../../application/orders/confirm-order-delivery.service.js";
import type { ReconcileShipmentStatusService } from "../../application/fulfillment/reconcile-shipment-status.service.js";
import type { HandleShippingWebhookService } from "../../application/fulfillment/handle-shipping-webhook.service.js";
import type { PaymentService } from "../../application/payments/payment.service.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type { HttpAccessRepository } from "../../ports/http-access-repository.js";
import { authorizeOrderAccess, requireOperatorAuth } from "./auth.js";
import { HttpError, mapErrorToHttpError } from "./errors.js";
import { jsonResponse, parseJsonBody } from "./json.js";
import { logHttpEvent } from "./logging.js";
import { requireHmacWebhookSignature } from "./webhook-security.js";

const keyValueRecordSchema = z.custom<KeyValueRecord>((value) => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}, "Expected JSON object");

const initiatePaymentSchema = z.object({
  orderId: z.string().min(1),
  provider: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: z.string().min(1),
  metadata: keyValueRecordSchema.optional(),
  rawPayload: keyValueRecordSchema.optional()
});

const paymentWebhookSchema = z.object({
  paymentAttemptId: z.string().min(1),
  provider: z.string().min(1),
  event: z.enum(["payment.processing", "payment.succeeded", "payment.failed"]),
  providerReference: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  metadata: keyValueRecordSchema.optional(),
  rawPayload: keyValueRecordSchema.optional()
});

const orderCommandSchema = z.object({
  orderId: z.string().min(1)
});

const bookShipmentSchema = orderCommandSchema.extend({
  destinationCity: z.string().min(1).optional()
});

export interface SelloraHttpHandlerDependencies {
  accessRepository: HttpAccessRepository;
  paymentService: Pick<PaymentService, "initiatePaymentAttempt" | "markProcessing" | "markSucceeded" | "markFailed">;
  bookOrderShipmentService: Pick<BookOrderShipmentService, "execute">;
  confirmOrderDeliveryService: Pick<ConfirmOrderDeliveryService, "execute">;
  handleShippingWebhookService: Pick<HandleShippingWebhookService, "execute">;
  reconcileShipmentStatusService: Pick<ReconcileShipmentStatusService, "execute">;
  operatorApiToken?: string;
  paymentWebhookSecret?: string;
  karrioWebhookSecret?: string;
}

export const SELLORA_HTTP_ENDPOINTS = {
  initiatePayment: "/api/payments/attempts",
  paymentWebhook: "/api/payments/webhooks/generic",
  bookShipment: "/api/fulfillment/shipments/book",
  confirmDelivery: "/api/fulfillment/deliveries/confirm",
  shippingWebhook: "/api/fulfillment/webhooks/karrio",
  reconcileShipment: "/api/fulfillment/shipments/reconcile"
} as const;

async function withHttpBoundary(
  route: string,
  handler: () => Promise<Response>
): Promise<Response> {
  try {
    const response = await handler();
    logHttpEvent("info", "http_request_completed", {
      route,
      status: response.status
    });
    return response;
  } catch (error) {
    const httpError = mapErrorToHttpError(error);
    logHttpEvent("error", "http_request_failed", {
      route,
      status: httpError.status,
      code: httpError.code,
      message: httpError.message
    });
    return jsonResponse(httpError.status, {
      error: {
        code: httpError.code,
        message: httpError.message
      }
    });
  }
}

export function createSelloraHttpHandlers(
  dependencies: SelloraHttpHandlerDependencies
) {
  return {
    initiatePayment: (request: Request) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.initiatePayment, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const body = await parseJsonBody(request, initiatePaymentSchema);
        await authorizeOrderAccess(dependencies.accessRepository, actor.sellerId, body.orderId);

        const result = await dependencies.paymentService.initiatePaymentAttempt({
          sellerId: actor.sellerId,
          orderId: body.orderId,
          provider: body.provider,
          amountMinor: body.amountMinor,
          currency: body.currency,
          idempotencyKey: request.headers.get("idempotency-key") ?? undefined,
          metadata: body.metadata,
          rawPayload: body.rawPayload
        });

        return jsonResponse(201, {
          paymentAttempt: result.attempt,
          order: result.order
        });
      }),

    paymentWebhook: (request: Request) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.paymentWebhook, async () => {
        const rawBody = await request.text();
        requireHmacWebhookSignature(
          rawBody,
          request.headers.get("x-sellora-payment-signature"),
          dependencies.paymentWebhookSecret,
          "x-sellora-payment-signature"
        );

        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          throw new HttpError(400, "invalid_json", "Request body must be valid JSON");
        }

        const body = paymentWebhookSchema.parse(parsedBody);

        let result;
        switch (body.event) {
          case "payment.processing":
            result = await dependencies.paymentService.markProcessing({
              paymentAttemptId: body.paymentAttemptId,
              metadata: body.metadata,
              rawPayload: body.rawPayload
            });
            break;
          case "payment.succeeded":
            if (!body.providerReference) {
              throw new HttpError(400, "provider_reference_required", "providerReference is required for payment success");
            }
            result = await dependencies.paymentService.markSucceeded({
              paymentAttemptId: body.paymentAttemptId,
              provider: body.provider,
              providerReference: body.providerReference,
              metadata: body.metadata,
              rawPayload: body.rawPayload
            });
            break;
          case "payment.failed":
            result = await dependencies.paymentService.markFailed({
              paymentAttemptId: body.paymentAttemptId,
              reason: body.reason,
              metadata: body.metadata,
              rawPayload: body.rawPayload
            });
            break;
        }

        return jsonResponse(200, {
          paymentAttempt: result.attempt,
          order: result.order
        });
      }),

    bookShipment: (request: Request) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.bookShipment, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const body = await parseJsonBody(request, bookShipmentSchema);
        await authorizeOrderAccess(dependencies.accessRepository, actor.sellerId, body.orderId);

        const result = await dependencies.bookOrderShipmentService.execute(body);

        return jsonResponse(200, result);
      }),

    confirmDelivery: (request: Request) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.confirmDelivery, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const body = await parseJsonBody(request, orderCommandSchema);
        await authorizeOrderAccess(dependencies.accessRepository, actor.sellerId, body.orderId);

        const result = await dependencies.confirmOrderDeliveryService.execute(body);

        return jsonResponse(200, result);
      }),

    shippingWebhook: (request: Request) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.shippingWebhook, async () => {
        const rawBody = await request.text();
        if (!dependencies.karrioWebhookSecret) {
          throw new HttpError(503, "webhook_unconfigured", "Karrio webhook secret is not configured");
        }

        const result = await handleKarrioWebhookRequest(
          dependencies.handleShippingWebhookService,
          {
            headers: Object.fromEntries(request.headers.entries()),
            rawBody,
            secret: dependencies.karrioWebhookSecret
          }
        );

        return jsonResponse(200, result);
      }),

    reconcileShipment: (request: Request) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.reconcileShipment, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const body = await parseJsonBody(request, orderCommandSchema);
        await authorizeOrderAccess(dependencies.accessRepository, actor.sellerId, body.orderId);

        const result = await dependencies.reconcileShipmentStatusService.execute(body);

        return jsonResponse(200, result);
      })
  };
}
