# Sellora

Sellora is being built as a commerce operating kernel with authoritative domain truth, inventory-ledger discipline, and policy-governed automation layered on top.

## Why A New Repo

Sellora is intentionally separate from:

- `order-management-backend`
- `makful-app`

Those repos contain useful business logic and production learnings, but they also carry product-specific assumptions. This repo starts from a generic platform core and selectively ports proven pieces.

## Product Goal

Build a backend-first commerce core that can later support seller-facing products such as:

- manage a catalog
- sell through WhatsApp-led and storefront-led journeys
- create quotes, invoices, orders, and deposits
- run fulfillment
- apply category-specific verification workflows
- sell through branded storefronts or operator dashboards
- operate in Arabic and English without bolted-on localization
- import supplier products into draft listings with AI enrichment
- layer policy-governed automation on top of clean commerce truth

## Market Position

Sellora is not aiming to be a generic store builder.

It is being shaped as a UAE-native commerce operating system with:

- Arabic and English localization
- WhatsApp-first conversion support
- quote-to-order and invoice workflows
- trust features for resale, warranty, and verified inventory
- multi-tenant seller operations

## Initial Scope

- multi-tenant seller model
- category-agnostic catalog
- authoritative order creation and order lifecycle
- inventory ledger and stock reservation discipline
- payment lifecycle
- shipment and fulfillment hooks
- verification templates by category
- migration path from the legacy apps

## Docs

- [Platform Plan](./docs/PLATFORM_PLAN.md)
- [Migration Copy Map](./docs/MIGRATION_COPY_MAP.md)
- [Reference Architecture](./docs/REFERENCE_ARCHITECTURE.md)
- [AI Sourcing Strategy](./docs/AI_SOURCING_STRATEGY.md)
- [Opportunity Engine](./docs/OPPORTUNITY_ENGINE.md)
- [Autonomous Sellora](./docs/AUTONOMOUS_SELLORA.md)
- [Autonomy Guardrails](./docs/AUTONOMY_GUARDRAILS.md)
- [Stack Decisions](./docs/STACK_DECISIONS.md)
- [North Star](./docs/NORTH_STAR.md)
- [Open Source Stack Map](./docs/OSS_STACK_MAP.md)
- [Build Order](./docs/BUILD_ORDER.md)

## Starter Code

The `src/domain` tree contains the generic platform core:

- `tenancy`
- `catalog`
- `orders`
- `verification`
- `quotes`
- `messaging`
- `localization`
- `sourcing`
- `opportunities`
- `autonomy`
- `ports`
- `events`

These files are intentionally small and explicit so we can evolve the architecture without dragging in old debt.

## Current Scaffold

The repo now includes:

- a generic Prisma schema in `prisma/schema.prisma`
- environment validation in `src/core/config.ts`
- Prisma client wiring in `src/core/db/prisma.ts`
- category template registry in `src/modules/catalog`
- order state machine and inventory ledger modules in `src/modules/orders`
- authoritative order creation service and Prisma checkout repository
- quote and messaging starter domains
- UAE market profile scaffolding
- supplier sourcing and AI enrichment starter domains
- profit opportunity discovery and scoring starter domains
- autonomous agent and workflow starter domains
- workflow and integration port contracts
- adapter stubs for Temporal, Stagehand, Chatwoot, Karrio, Convoy, and Mastra
- Prisma-backed repositories for source listings, opportunities, autonomy policies, workflow runs, and action logs
- legacy intake planning in `src/modules/migration`

## Deployment

Single-instance deployment is container-first.

1. Build the image:
   `docker build -t sellora:latest .`
2. Provide production env vars, especially:
   `DATABASE_URL`, `OPERATOR_API_TOKEN`, `PAYMENT_WEBHOOK_SECRET`, `KARRIO_WEBHOOK_SECRET`
3. Run migrations on startup:
   the container entrypoint runs `npx prisma migrate deploy`
4. Start the service:
   the container serves HTTP on port `3000`
5. Verify:
   `GET /health`
   `GET /ready`

## Next Build Steps

1. Implement the authoritative order transition service.
2. Add cancel -> release inventory and fulfill -> deduct inventory flows.
3. Add truthful order events and idempotency checks around the order lifecycle.
4. Add payment core only after the order lifecycle is complete.
