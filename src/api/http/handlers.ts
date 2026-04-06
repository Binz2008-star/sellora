import { z } from "zod";
import { handleKarrioWebhookRequest } from "../../application/fulfillment/handle-karrio-webhook.request.js";
import type { AcknowledgeNotificationService } from "../../application/notifications/acknowledge-notification.service.js";
import type { BookOrderShipmentService } from "../../application/orders/book-order-shipment.service.js";
import type { ConfirmOrderDeliveryService } from "../../application/orders/confirm-order-delivery.service.js";
import type { ReconcileShipmentStatusService } from "../../application/fulfillment/reconcile-shipment-status.service.js";
import type { HandleShippingWebhookService } from "../../application/fulfillment/handle-shipping-webhook.service.js";
import type { PaymentService } from "../../application/payments/payment.service.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type { HttpAccessRepository } from "../../ports/http-access-repository.js";
import type { NotificationQueryRepository } from "../../ports/notification-query-repository.js";
import type { OperatorQueryRepository } from "../../ports/operator-query-repository.js";
import {
  authorizeNotificationAccess,
  authorizeOrderAccess,
  requireOperatorAuth
} from "./auth.js";
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

const orderPathParamsSchema = z.object({
  orderId: z.string().min(1)
});

const notificationPathParamsSchema = z.object({
  notificationId: z.string().min(1)
});

const notificationListQuerySchema = z.object({
  status: z.enum(["pending", "sent", "failed"]).optional(),
  acknowledged: z.enum(["true", "false"]).optional()
});

type OrderPathParams = z.infer<typeof orderPathParamsSchema>;
type NotificationPathParams = z.infer<typeof notificationPathParamsSchema>;

export interface SelloraHttpHandlerDependencies {
  accessRepository: HttpAccessRepository;
  operatorQueryRepository: OperatorQueryRepository;
  notificationQueryRepository: NotificationQueryRepository;
  acknowledgeNotificationService: Pick<AcknowledgeNotificationService, "execute">;
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
  listNotifications: "/api/notifications",
  getNotification: "/api/notifications/:notificationId",
  acknowledgeNotification: "/api/notifications/:notificationId/acknowledge",
  getOrder: "/api/orders/:orderId",
  getOrderPayments: "/api/orders/:orderId/payments",
  getOrderFulfillment: "/api/orders/:orderId/fulfillment",
  getOrderTimeline: "/api/orders/:orderId/timeline",
  getOrderShippingWebhooks: "/api/orders/:orderId/shipping-webhooks",
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
  const requireOrderParams = (params: unknown): OrderPathParams => orderPathParamsSchema.parse(params);
  const requireNotificationParams = (params: unknown): NotificationPathParams =>
    notificationPathParamsSchema.parse(params);

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

    listNotifications: (request: Request) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.listNotifications, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const url = new URL(request.url);
        const query = notificationListQuerySchema.parse({
          status: url.searchParams.get("status") ?? undefined,
          acknowledged: url.searchParams.get("acknowledged") ?? undefined
        });

        const notifications = await dependencies.notificationQueryRepository.listNotifications({
          sellerId: actor.sellerId,
          status: query.status,
          acknowledged:
            query.acknowledged === undefined ? undefined : query.acknowledged === "true"
        });

        return jsonResponse(200, {
          notifications
        });
      }),

    getNotification: (request: Request, params: unknown) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.getNotification, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const path = requireNotificationParams(params);
        await authorizeNotificationAccess(
          dependencies.accessRepository,
          actor.sellerId,
          path.notificationId
        );

        const notification = await dependencies.notificationQueryRepository.getNotificationDetail(
          path.notificationId
        );
        if (!notification) {
          throw new HttpError(404, "not_found", `Notification not found: ${path.notificationId}`);
        }

        return jsonResponse(200, {
          notification
        });
      }),

    acknowledgeNotification: (request: Request, params: unknown) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.acknowledgeNotification, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const path = requireNotificationParams(params);
        await authorizeNotificationAccess(
          dependencies.accessRepository,
          actor.sellerId,
          path.notificationId
        );

        const notification = await dependencies.acknowledgeNotificationService.execute({
          notificationId: path.notificationId,
          sellerId: actor.sellerId
        });

        return jsonResponse(200, {
          notification
        });
      }),

    getOrder: (request: Request, params: unknown) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.getOrder, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const path = requireOrderParams(params);
        await authorizeOrderAccess(dependencies.accessRepository, actor.sellerId, path.orderId);

        const detail = await dependencies.operatorQueryRepository.getOrderDetail(path.orderId);
        if (!detail) {
          throw new HttpError(404, "not_found", `Order not found: ${path.orderId}`);
        }

        return jsonResponse(200, detail);
      }),

    getOrderPayments: (request: Request, params: unknown) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.getOrderPayments, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const path = requireOrderParams(params);
        await authorizeOrderAccess(dependencies.accessRepository, actor.sellerId, path.orderId);

        const payments = await dependencies.operatorQueryRepository.listPaymentAttempts(path.orderId);

        return jsonResponse(200, {
          orderId: path.orderId,
          paymentAttempts: payments
        });
      }),

    getOrderFulfillment: (request: Request, params: unknown) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.getOrderFulfillment, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const path = requireOrderParams(params);
        await authorizeOrderAccess(dependencies.accessRepository, actor.sellerId, path.orderId);

        const fulfillment = await dependencies.operatorQueryRepository.getFulfillment(path.orderId);

        return jsonResponse(200, {
          orderId: path.orderId,
          fulfillment
        });
      }),

    getOrderTimeline: (request: Request, params: unknown) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.getOrderTimeline, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const path = requireOrderParams(params);
        await authorizeOrderAccess(dependencies.accessRepository, actor.sellerId, path.orderId);

        const timeline = await dependencies.operatorQueryRepository.listOrderTimeline(path.orderId);

        return jsonResponse(200, {
          orderId: path.orderId,
          timeline
        });
      }),

    getOrderShippingWebhooks: (request: Request, params: unknown) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.getOrderShippingWebhooks, async () => {
        const actor = requireOperatorAuth(request, dependencies.operatorApiToken);
        const path = requireOrderParams(params);
        await authorizeOrderAccess(dependencies.accessRepository, actor.sellerId, path.orderId);

        const receipts = await dependencies.operatorQueryRepository.listShippingWebhookReceipts(path.orderId);

        return jsonResponse(200, {
          orderId: path.orderId,
          receipts
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
