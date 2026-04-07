import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { prisma } from "./core/db/prisma.js";
import { loadConfig } from "./core/config.js";
import { logOperationalEvent } from "./core/logging.js";
import { PrismaHttpAccessRepository } from "./adapters/prisma/http-access.repository.js";
import { PrismaOperatorQueryRepository } from "./adapters/prisma/operator-query.repository.js";
import { PrismaNotificationQueryRepository } from "./adapters/prisma/notification-query.repository.js";
import { PrismaNotificationRepository } from "./adapters/prisma/notification.repository.js";
import { PrismaPaymentRepository } from "./adapters/prisma/payment.repository.js";
import { PrismaFulfillmentRepository } from "./adapters/prisma/fulfillment.repository.js";
import { PrismaShippingWebhookRepository } from "./adapters/prisma/shipping-webhook.repository.js";
import { PrismaOrderLifecycleRepository } from "./adapters/prisma/order-lifecycle.repository.js";
import { PrismaStorefrontSettingsRepository } from "./adapters/prisma/storefront-settings.repository.js";
import { PrismaTenantRepository } from "./adapters/prisma/tenant.repository.js";
import { AcknowledgeNotificationService } from "./application/notifications/acknowledge-notification.service.js";
import { SendOrderNotificationService } from "./application/notifications/send-order-notification.service.js";
import { HealthCheckService } from "./application/operations/health-check.service.js";
import { PaymentService } from "./application/payments/payment.service.js";
import { EvaluateRetrievalBenchmarkService } from "./application/retrieval/evaluate-retrieval-benchmark.service.js";
import { GetRetrievalBenchmarkDatasetService } from "./application/retrieval/get-retrieval-benchmark-dataset.service.js";
import { RunRetrievalQueryService } from "./application/retrieval/run-retrieval-query.service.js";
import { CreateTenantService } from "./application/tenancy/create-tenant.service.js";
import { GetSellerStorefrontSettingsService } from "./application/tenancy/get-seller-storefront-settings.service.js";
import { UpdateSellerStorefrontSettingsService } from "./application/tenancy/update-seller-storefront-settings.service.js";
import { TransitionOrderService } from "./application/orders/transition-order.service.js";
import { BookOrderShipmentService } from "./application/orders/book-order-shipment.service.js";
import { ConfirmOrderDeliveryService } from "./application/orders/confirm-order-delivery.service.js";
import { HandleShippingWebhookService } from "./application/fulfillment/handle-shipping-webhook.service.js";
import { ReconcileShipmentStatusService } from "./application/fulfillment/reconcile-shipment-status.service.js";
import { NotificationFanoutEventBus } from "./modules/events/notification-fanout-event-bus.js";
import { createSelloraHttpHandlers } from "./api/http/handlers.js";
import { createNotificationGateway } from "./modules/platform/notification-gateway-factory.js";
import { createRetrievalEngine } from "./modules/platform/retrieval-engine-factory.js";
import { createShippingGateway } from "./modules/platform/shipping-gateway-factory.js";
import { NoopEventBus } from "./adapters/noop/noop-event-bus.js";

type RouteMatch = {
  method: string;
  pattern: RegExp;
  buildParams: (match: RegExpExecArray) => Record<string, string>;
  handle: (request: Request, params?: Record<string, string>) => Promise<Response>;
};

function flattenHeaders(headers: IncomingMessage["headers"]): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).flatMap(([key, value]) => {
      if (value === undefined) {
        return [];
      }

      return [[key, Array.isArray(value) ? value.join(", ") : value]];
    })
  );
}

async function readRawBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function createWebRequest(request: IncomingMessage, rawBody: string, origin: string): Request {
  const url = new URL(request.url ?? "/", origin);
  const method = request.method ?? "GET";

  return new Request(url, {
    method,
    headers: flattenHeaders(request.headers),
    body: method === "GET" || method === "HEAD" ? undefined : rawBody
  });
}

async function writeWebResponse(response: Response, nodeResponse: ServerResponse): Promise<void> {
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });
  nodeResponse.end(await response.text());
}

function createRoutes(handlers: ReturnType<typeof createSelloraHttpHandlers>): RouteMatch[] {
  return [
    {
      method: "GET",
      pattern: /^\/health$/,
      buildParams: () => ({}),
      handle: () => handlers.health()
    },
    {
      method: "GET",
      pattern: /^\/ready$/,
      buildParams: () => ({}),
      handle: () => handlers.readiness()
    },
    {
      method: "POST",
      pattern: /^\/api\/admin\/tenants$/,
      buildParams: () => ({}),
      handle: (request) => handlers.createTenant(request)
    },
    {
      method: "GET",
      pattern: /^\/api\/admin\/retrieval\/benchmarks$/,
      buildParams: () => ({}),
      handle: (request) => handlers.listRetrievalBenchmarks(request)
    },
    {
      method: "POST",
      pattern: /^\/api\/admin\/retrieval\/query$/,
      buildParams: () => ({}),
      handle: (request) => handlers.runRetrievalQuery(request)
    },
    {
      method: "POST",
      pattern: /^\/api\/admin\/retrieval\/benchmark\/evaluate$/,
      buildParams: () => ({}),
      handle: (request) => handlers.evaluateRetrievalBenchmark(request)
    },
    {
      method: "POST",
      pattern: /^\/api\/admin\/retrieval\/benchmark\/evaluate\/([^/]+)$/,
      buildParams: (match) => ({ datasetId: match[1] }),
      handle: (request, params) => handlers.evaluateBuiltInRetrievalBenchmark(request, params)
    },
    {
      method: "GET",
      pattern: /^\/api\/seller\/storefront$/,
      buildParams: () => ({}),
      handle: (request) => handlers.getSellerStorefront(request)
    },
    {
      method: "PATCH",
      pattern: /^\/api\/seller\/storefront$/,
      buildParams: () => ({}),
      handle: (request) => handlers.updateSellerStorefront(request)
    },
    {
      method: "POST",
      pattern: /^\/api\/payments\/attempts$/,
      buildParams: () => ({}),
      handle: (request) => handlers.initiatePayment(request)
    },
    {
      method: "POST",
      pattern: /^\/api\/payments\/webhooks\/generic$/,
      buildParams: () => ({}),
      handle: (request) => handlers.paymentWebhook(request)
    },
    {
      method: "GET",
      pattern: /^\/api\/notifications$/,
      buildParams: () => ({}),
      handle: (request) => handlers.listNotifications(request)
    },
    {
      method: "GET",
      pattern: /^\/api\/notifications\/([^/]+)$/,
      buildParams: (match) => ({ notificationId: match[1] }),
      handle: (request, params) => handlers.getNotification(request, params)
    },
    {
      method: "POST",
      pattern: /^\/api\/notifications\/([^/]+)\/acknowledge$/,
      buildParams: (match) => ({ notificationId: match[1] }),
      handle: (request, params) => handlers.acknowledgeNotification(request, params)
    },
    {
      method: "GET",
      pattern: /^\/api\/orders\/([^/]+)$/,
      buildParams: (match) => ({ orderId: match[1] }),
      handle: (request, params) => handlers.getOrder(request, params)
    },
    {
      method: "GET",
      pattern: /^\/api\/orders\/([^/]+)\/payments$/,
      buildParams: (match) => ({ orderId: match[1] }),
      handle: (request, params) => handlers.getOrderPayments(request, params)
    },
    {
      method: "GET",
      pattern: /^\/api\/orders\/([^/]+)\/fulfillment$/,
      buildParams: (match) => ({ orderId: match[1] }),
      handle: (request, params) => handlers.getOrderFulfillment(request, params)
    },
    {
      method: "GET",
      pattern: /^\/api\/orders\/([^/]+)\/timeline$/,
      buildParams: (match) => ({ orderId: match[1] }),
      handle: (request, params) => handlers.getOrderTimeline(request, params)
    },
    {
      method: "GET",
      pattern: /^\/api\/orders\/([^/]+)\/shipping-webhooks$/,
      buildParams: (match) => ({ orderId: match[1] }),
      handle: (request, params) => handlers.getOrderShippingWebhooks(request, params)
    },
    {
      method: "POST",
      pattern: /^\/api\/fulfillment\/shipments\/book$/,
      buildParams: () => ({}),
      handle: (request) => handlers.bookShipment(request)
    },
    {
      method: "POST",
      pattern: /^\/api\/fulfillment\/deliveries\/confirm$/,
      buildParams: () => ({}),
      handle: (request) => handlers.confirmDelivery(request)
    },
    {
      method: "POST",
      pattern: /^\/api\/fulfillment\/webhooks\/karrio$/,
      buildParams: () => ({}),
      handle: (request) => handlers.shippingWebhook(request)
    },
    {
      method: "POST",
      pattern: /^\/api\/fulfillment\/shipments\/reconcile$/,
      buildParams: () => ({}),
      handle: (request) => handlers.reconcileShipment(request)
    }
  ];
}

const config = loadConfig();
const notificationGateway = createNotificationGateway(config);
const innerEventBus = new NoopEventBus();
const retrievalEngine = createRetrievalEngine(config);
const retrievalBenchmarkDatasetService = new GetRetrievalBenchmarkDatasetService();
const notificationRepository = new PrismaNotificationRepository();
const notificationService = new SendOrderNotificationService(notificationRepository, notificationGateway);
const eventBus = new NotificationFanoutEventBus(innerEventBus, notificationService);
const storefrontSettingsRepository = new PrismaStorefrontSettingsRepository();
const transitionOrderService = new TransitionOrderService(new PrismaOrderLifecycleRepository(), eventBus);
const fulfillmentRepository = new PrismaFulfillmentRepository();
const shippingGateway = createShippingGateway(config);
const confirmOrderDeliveryService = new ConfirmOrderDeliveryService(
  fulfillmentRepository,
  transitionOrderService
);
const handleShippingWebhookService = new HandleShippingWebhookService(
  new PrismaShippingWebhookRepository(),
  fulfillmentRepository,
  confirmOrderDeliveryService,
  eventBus
);
const handlers = createSelloraHttpHandlers({
  accessRepository: new PrismaHttpAccessRepository(),
  operatorQueryRepository: new PrismaOperatorQueryRepository(),
  notificationQueryRepository: new PrismaNotificationQueryRepository(),
  createTenantService: new CreateTenantService(new PrismaTenantRepository()),
  runRetrievalQueryService: new RunRetrievalQueryService(
    retrievalEngine,
    config.RETRIEVAL_TOP_K_DEFAULT
  ),
  evaluateRetrievalBenchmarkService: new EvaluateRetrievalBenchmarkService(retrievalEngine),
  getRetrievalBenchmarkDatasetService: retrievalBenchmarkDatasetService,
  getSellerStorefrontSettingsService: new GetSellerStorefrontSettingsService(storefrontSettingsRepository),
  updateSellerStorefrontSettingsService: new UpdateSellerStorefrontSettingsService(storefrontSettingsRepository),
  acknowledgeNotificationService: new AcknowledgeNotificationService(notificationRepository),
  healthCheckService: new HealthCheckService(config, async () => {
    await prisma.$queryRaw`SELECT 1`;
  }),
  paymentService: new PaymentService(
    new PrismaPaymentRepository(),
    transitionOrderService,
    undefined,
    eventBus
  ),
  bookOrderShipmentService: new BookOrderShipmentService(
    fulfillmentRepository,
    shippingGateway,
    transitionOrderService
  ),
  confirmOrderDeliveryService,
  handleShippingWebhookService,
  reconcileShipmentStatusService: new ReconcileShipmentStatusService(
    fulfillmentRepository,
    shippingGateway,
    handleShippingWebhookService
  ),
  operatorApiToken: config.OPERATOR_API_TOKEN,
  paymentWebhookSecret: config.PAYMENT_WEBHOOK_SECRET,
  karrioWebhookSecret: config.KARRIO_WEBHOOK_SECRET
});
const routes = createRoutes(handlers);
const origin = `http://${config.APP_HOST}:${config.APP_PORT}`;

const server = createServer(async (request, response) => {
  const method = request.method ?? "GET";
  const pathname = new URL(request.url ?? "/", origin).pathname;
  const route = routes.find((candidate) => candidate.method === method && candidate.pattern.test(pathname));

  if (!route) {
    response.statusCode = 404;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({
      error: {
        code: "not_found",
        message: `Route not found: ${method} ${pathname}`
      }
    }));
    return;
  }

  try {
    const rawBody = await readRawBody(request);
    const webRequest = createWebRequest(request, rawBody, origin);
    const match = route.pattern.exec(pathname);
    const params = match ? route.buildParams(match) : {};
    const webResponse = await route.handle(webRequest, params);
    await writeWebResponse(webResponse, response);
  } catch (error) {
    logOperationalEvent("error", "http_server_unhandled_error", {
      method,
      pathname,
      message: error instanceof Error ? error.message : "Unhandled server error"
    });
    response.statusCode = 500;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({
      error: {
        code: "internal_error",
        message: "Internal server error"
      }
    }));
  }
});

async function closeServer(signal: string): Promise<void> {
  logOperationalEvent("info", "http_server_shutdown_started", { signal });

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  await prisma.$disconnect();
  logOperationalEvent("info", "http_server_shutdown_completed", { signal });
}

process.once("SIGINT", () => {
  void closeServer("SIGINT").finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void closeServer("SIGTERM").finally(() => process.exit(0));
});

await prisma.$connect();

server.listen(config.APP_PORT, config.APP_HOST, () => {
  logOperationalEvent("info", "http_server_started", {
    host: config.APP_HOST,
    port: config.APP_PORT
  });
});
