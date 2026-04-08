# Sellora

Sellora is a **platform intelligence layer** that provides business intelligence, AI sourcing, and workflow automation on top of the `order-management-backend` runtime core.

## Architecture Position

Sellora operates as a **peer platform layer** that:

- **Consumes** from `order-management-backend` (runtime core)
- **Provides** specialized APIs to `seller-dashboard` (UI layer)
- **Operates independently** of other platform layers

## Platform Focus

Sellora owns **business intelligence and automation**:

- Catalog Management (product definitions, categories, templates)
- AI Sourcing (supplier product import, enrichment, normalization)
- Opportunity Engine (profit discovery, scoring, recommendations)
- Autonomous Workflows (policy-governed automation, decision engines)
- Platform Integration (external services, third-party APIs)
- Localization (Arabic/English language support)
- WhatsApp Integration (messaging, conversational commerce)
- Multi-tenant Management (seller onboarding, platform policies)

## Market Position

Sellora is a **UAE-native commerce platform** with:

- Arabic and English localization
- WhatsApp-first conversion support
- AI-powered product sourcing
- Automated workflow orchestration
- Multi-tenant seller operations

## Platform Scope

- Category-agnostic catalog management
- AI-powered supplier product import
- Profit opportunity discovery and scoring
- Policy-governed automation workflows
- External service integrations
- Localization and cultural adaptation

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

## Platform Architecture

The `src/domain` tree contains the platform intelligence core:

- `catalog` - Product definitions and categories
- `sourcing` - AI-powered supplier import
- `opportunities` - Profit discovery and scoring
- `autonomy` - Policy-governed workflows
- `localization` - Arabic/English support
- `integration` - External service adapters
- `tenancy` - Multi-tenant management

## Current Implementation

The repo includes:

- Platform-specific Prisma schema in `prisma/schema.prisma`
- Runtime API client for consuming `order-management-backend`
- Catalog management modules and templates
- AI sourcing and enrichment pipelines
- Opportunity discovery and scoring engines
- Workflow automation and policy engines
- WhatsApp integration and messaging
- Localization and cultural adaptation
- External service integration adapters

## Runtime Integration

Sellora consumes from `order-management-backend`:

- Order creation and status APIs
- Payment processing and status APIs
- Authentication and user management APIs
- Inventory and fulfillment APIs

## Platform APIs

Sellora provides to `seller-dashboard`:

- Catalog management APIs
- AI sourcing and enrichment APIs
- Opportunity discovery APIs
- Workflow automation APIs
- Localization and messaging APIs

## Deployment

Container-first deployment as platform service:

1. Build platform image:
   `docker build -t sellora:latest .`
2. Configure runtime API connections
3. Deploy as independent platform service
4. Verify platform APIs:
   `GET /health`
   `GET /catalog/products`
   `GET /opportunities`
