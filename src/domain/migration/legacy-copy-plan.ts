export interface LegacySource {
  repository: "order-management-backend" | "makful-app";
  sourcePath: string;
  targetModule: string;
  decision: "copy-and-adapt" | "reference-only" | "rewrite";
  reason: string;
}

export const LEGACY_COPY_PLAN: LegacySource[] = [
  {
    repository: "order-management-backend",
    sourcePath: "src/server/services/order.service.ts",
    targetModule: "src/domain/orders",
    decision: "copy-and-adapt",
    reason: "Contains proven transaction and stock protection logic."
  },
  {
    repository: "order-management-backend",
    sourcePath: "src/server/services/order-transition.service.ts",
    targetModule: "src/domain/orders",
    decision: "copy-and-adapt",
    reason: "Good basis for the new single-source order state machine."
  },
  {
    repository: "order-management-backend",
    sourcePath: "src/server/services/payment.service.ts",
    targetModule: "src/domain/orders",
    decision: "copy-and-adapt",
    reason: "Payment lifecycle hardening should be reused in the new platform."
  },
  {
    repository: "order-management-backend",
    sourcePath: "src/app/api/webhooks/stripe/route.ts",
    targetModule: "future payment webhook module",
    decision: "copy-and-adapt",
    reason: "Webhook idempotency and provider handling are high-value proven logic."
  },
  {
    repository: "makful-app",
    sourcePath: "src/server/actions/createReservation.ts",
    targetModule: "future reservation application service",
    decision: "copy-and-adapt",
    reason: "Strong starting point for reservation-first purchase flows."
  },
  {
    repository: "makful-app",
    sourcePath: "prisma/schema.prisma",
    targetModule: "docs and verification domain",
    decision: "reference-only",
    reason: "Contains useful category concepts, but should not be copied as platform schema."
  },
  {
    repository: "makful-app",
    sourcePath: "src/app/api/reserve/route.ts",
    targetModule: "future public order API",
    decision: "rewrite",
    reason: "The transport layer is too app-specific and should be rebuilt around the new contracts."
  }
];
