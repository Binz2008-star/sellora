# Sellora

Sellora is a clean-slate autonomous commerce platform for UAE social sellers, verified resale, quote-to-order businesses, and AI-assisted supplier-driven catalog building.

## Why A New Repo

Sellora is intentionally separate from:

- `order-management-backend`
- `makful-app`

Those repos contain useful business logic and production learnings, but they also carry product-specific assumptions. This repo starts from a generic platform core and selectively ports proven pieces.

## Product Goal

Build a platform where any seller can:

- manage a catalog
- sell through WhatsApp-led and storefront-led journeys
- create quotes, invoices, orders, and deposits
- run fulfillment
- apply category-specific verification workflows
- sell through branded storefronts or operator dashboards
- operate in Arabic and English without bolted-on localization
- import supplier products into draft listings with AI enrichment
- discover profitable product opportunities across multiple source types
- operate autonomous sourcing, listing, sales, and fulfillment loops

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
- order and payment lifecycle
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
- order transition service in `src/modules/orders`
- quote and messaging starter domains
- UAE market profile scaffolding
- supplier sourcing and AI enrichment starter domains
- profit opportunity discovery and scoring starter domains
- autonomous agent and workflow starter domains
- workflow and integration port contracts
- adapter stubs for Temporal, Stagehand, Chatwoot, Karrio, Convoy, and Mastra
- Prisma-backed repositories for source listings, opportunities, autonomy policies, workflow runs, and action logs
- legacy intake planning in `src/modules/migration`

## Next Build Steps

1. Install dependencies.
2. Generate the Prisma client.
3. Create the first application service layer around sellers, catalog, orders, quotes, messaging, and sourcing.
4. Port proven logic from the legacy repos into the new modules.
