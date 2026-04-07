import { z } from "zod";
import { handleKarrioWebhookRequest } from "../../application/fulfillment/handle-karrio-webhook.request.js";
import type { EvaluateRetrievalBenchmarkService } from "../../application/retrieval/evaluate-retrieval-benchmark.service.js";
import type { GetRetrievalBenchmarkDatasetService } from "../../application/retrieval/get-retrieval-benchmark-dataset.service.js";
import type { RunRetrievalQueryService } from "../../application/retrieval/run-retrieval-query.service.js";
import type { CreateTenantService } from "../../application/tenancy/create-tenant.service.js";
import type { AcknowledgeNotificationService } from "../../application/notifications/acknowledge-notification.service.js";
import type { BookOrderShipmentService } from "../../application/orders/book-order-shipment.service.js";
import type { ConfirmOrderDeliveryService } from "../../application/orders/confirm-order-delivery.service.js";
import type { ReconcileShipmentStatusService } from "../../application/fulfillment/reconcile-shipment-status.service.js";
import type { HandleShippingWebhookService } from "../../application/fulfillment/handle-shipping-webhook.service.js";
import type { HealthCheckService } from "../../application/operations/health-check.service.js";
import type { PaymentService } from "../../application/payments/payment.service.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type { HttpAccessRepository } from "../../ports/http-access-repository.js";
import type { NotificationQueryRepository } from "../../ports/notification-query-repository.js";
import type { OperatorQueryRepository } from "../../ports/operator-query-repository.js";
import {
  authorizeNotificationAccess,
  authorizeOrderAccess,
  requireAdminAuth,
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

const createTenantSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1),
  brandName: z.string().trim().min(1),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  whatsappNumber: z.string().trim().min(1).optional(),
  currency: z.string().trim().min(3).max(3).optional()
});

const retrievalDocumentSchema = z.object({
  id: z.string().min(1),
  language: z.string().trim().min(2),
  title: z.string().trim().min(1).optional(),
  body: z.string().trim().min(1),
  metadata: keyValueRecordSchema.optional()
});

const retrievalQuerySchema = z.object({
  query: z.string().trim().min(1),
  language: z.string().trim().min(2).optional(),
  topK: z.number().int().positive().max(100).optional(),
  corpus: z.array(retrievalDocumentSchema).min(1)
});

const retrievalBenchmarkSchema = z.object({
  dataset: z.object({
    id: z.string().min(1).optional(),
    name: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
    useCases: z.array(z.enum(["support_search", "help_center_grounding", "catalog_candidate_retrieval"])).optional(),
    corpus: z.array(retrievalDocumentSchema).min(1),
    cases: z.array(
      z.object({
        id: z.string().min(1),
        query: z.string().trim().min(1),
        language: z.string().trim().min(2),
        useCase: z.enum(["support_search", "help_center_grounding", "catalog_candidate_retrieval"]).optional(),
        relevantDocumentIds: z.array(z.string().min(1)).min(1),
        expectedPrimaryDocumentId: z.string().min(1).optional(),
        tags: z.array(z.string().trim().min(1)).optional()
      })
    ).min(1)
  }),
  topK: z.number().int().positive().max(100),
  failureRecallThreshold: z.number().min(0).max(1).optional()
});

const retrievalBenchmarkLookupParamsSchema = z.object({
  datasetId: z.string().trim().min(1)
});

const retrievalBenchmarkByIdSchema = z.object({
  topK: z.number().int().positive().max(100),
  failureRecallThreshold: z.number().min(0).max(1).optional()
});

type OrderPathParams = z.infer<typeof orderPathParamsSchema>;
type NotificationPathParams = z.infer<typeof notificationPathParamsSchema>;

function normalizeBenchmarkDataset(dataset: z.infer<typeof retrievalBenchmarkSchema>["dataset"]) {
  return {
    id: dataset.id ?? dataset.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: dataset.name,
    description: dataset.description ?? `Ad hoc retrieval benchmark dataset: ${dataset.name}`,
    useCases: dataset.useCases ?? ["support_search"],
    corpus: dataset.corpus,
    cases: dataset.cases.map((benchmarkCase) => ({
      ...benchmarkCase,
      useCase: benchmarkCase.useCase ?? dataset.useCases?.[0] ?? "support_search"
    }))
  };
}

export interface SelloraHttpHandlerDependencies {
  accessRepository: HttpAccessRepository;
  operatorQueryRepository: OperatorQueryRepository;
  notificationQueryRepository: NotificationQueryRepository;
  createTenantService: Pick<CreateTenantService, "execute">;
  runRetrievalQueryService: Pick<RunRetrievalQueryService, "execute">;
  evaluateRetrievalBenchmarkService: Pick<EvaluateRetrievalBenchmarkService, "execute">;
  getRetrievalBenchmarkDatasetService: Pick<GetRetrievalBenchmarkDatasetService, "list" | "getOrThrow">;
  acknowledgeNotificationService: Pick<AcknowledgeNotificationService, "execute">;
  healthCheckService: Pick<HealthCheckService, "getHealth" | "getReadiness">;
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
  health: "/health",
  readiness: "/ready",
  createTenant: "/api/admin/tenants",
  listRetrievalBenchmarks: "/api/admin/retrieval/benchmarks",
  retrievalQuery: "/api/admin/retrieval/query",
  retrievalBenchmark: "/api/admin/retrieval/benchmark/evaluate",
  retrievalBenchmarkById: "/api/admin/retrieval/benchmark/evaluate/:datasetId",
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
  const requireRetrievalBenchmarkLookupParams = (params: unknown) =>
    retrievalBenchmarkLookupParamsSchema.parse(params);

  return {
    health: () =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.health, async () => {
        return jsonResponse(200, dependencies.healthCheckService.getHealth());
      }),

    readiness: () =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.readiness, async () => {
        const readiness = await dependencies.healthCheckService.getReadiness();
        return jsonResponse(readiness.status === "ready" ? 200 : 503, readiness);
      }),

    createTenant: (request: Request) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.createTenant, async () => {
        requireAdminAuth(request, dependencies.operatorApiToken);
        const body = await parseJsonBody(request, createTenantSchema);
        const result = await dependencies.createTenantService.execute(body);

        return jsonResponse(201, {
          tenant: result
        });
      }),

    listRetrievalBenchmarks: (request: Request) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.listRetrievalBenchmarks, async () => {
        requireAdminAuth(request, dependencies.operatorApiToken);

        return jsonResponse(200, {
          datasets: dependencies.getRetrievalBenchmarkDatasetService.list()
        });
      }),

    runRetrievalQuery: (request: Request) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.retrievalQuery, async () => {
        requireAdminAuth(request, dependencies.operatorApiToken);
        const body = await parseJsonBody(request, retrievalQuerySchema);
        const result = await dependencies.runRetrievalQueryService.execute(body);

        return jsonResponse(200, {
          result
        });
      }),

    evaluateRetrievalBenchmark: (request: Request) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.retrievalBenchmark, async () => {
        requireAdminAuth(request, dependencies.operatorApiToken);
        const body = await parseJsonBody(request, retrievalBenchmarkSchema);
        const summary = await dependencies.evaluateRetrievalBenchmarkService.execute({
          dataset: normalizeBenchmarkDataset(body.dataset),
          topK: body.topK,
          failureRecallThreshold: body.failureRecallThreshold
        });

        return jsonResponse(200, {
          summary
        });
      }),

    evaluateBuiltInRetrievalBenchmark: (request: Request, params: unknown) =>
      withHttpBoundary(SELLORA_HTTP_ENDPOINTS.retrievalBenchmarkById, async () => {
        requireAdminAuth(request, dependencies.operatorApiToken);
        const path = requireRetrievalBenchmarkLookupParams(params);
        const body = await parseJsonBody(request, retrievalBenchmarkByIdSchema);
        const dataset = dependencies.getRetrievalBenchmarkDatasetService.getOrThrow(path.datasetId);
        const summary = await dependencies.evaluateRetrievalBenchmarkService.execute({
          dataset,
          topK: body.topK,
          failureRecallThreshold: body.failureRecallThreshold
        });

        return jsonResponse(200, {
          summary
        });
      }),

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
