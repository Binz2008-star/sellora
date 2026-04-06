# Sellora Platform Plan

## 0. Assumptions

- `order-management-backend` remains a source of proven backend patterns, not the new platform root.
- `makful-app` is treated as the first tenant and first category implementation, not the platform definition.
- The new platform must support non-phone sellers from day one.
- We will copy only proven code paths, not whole legacy folders.
- The first implementation target is a seller platform for UAE social commerce and verified resale.

## 1. Product Direction

Build Sellora as a commerce operating kernel for sellers who need:

- storefronts
- WhatsApp-led selling
- AI-assisted supplier catalog building
- order and payment workflows
- quote and invoice workflows
- fulfillment operations
- category-specific verification
- Arabic and English localization

This is not an iPhone app. It is a UAE-native commerce core with category extensions and messaging-led operations.
Automation is a layered capability on top of that core, not the system definition.

## 2. Product Boundaries

### In Scope

- seller and staff tenancy
- generic product catalog
- quote lifecycle
- invoice lifecycle
- order lifecycle
- payment lifecycle
- shipment lifecycle
- messaging and conversational lead capture
- UAE market localization
- verification templates by category
- audit events
- storefront configuration by seller

### Out Of Scope For The First Build

- marketplace search across many sellers
- accounting and ERP integrations
- advanced warehouse routing
- subscriptions and billing engine
- native mobile apps

## 3. Architecture Rules

1. Keep the core schema category-agnostic.
2. Move category-specific rules into templates, policies, and extension models.
3. Use one source of truth for orders, payments, and inventory.
4. Never run parallel state machines in multiple apps.
5. Port proven code paths only after they are mapped to the new domain model.
6. Treat WhatsApp and conversational selling as first-class channels, not side integrations.
7. Treat Arabic and English localization as core product behavior, not post-launch polish.

## 4. Platform Domain Model

### Core Domains

- `tenancy`: sellers, staff, roles, storefront settings
- `catalog`: products, media, pricing, inventory, category attributes
- `sourcing`: supplier connectors, import jobs, AI enrichment, draft approval
- `opportunities`: discovered listings, scoring, ranking, policy gating, publish recommendations
- `autonomy`: agent policies, workflow runs, retries, event-driven execution
- `quotes`: lead capture, proposals, approvals, quote-to-order conversion
- `orders`: carts or reservations, orders, events, payment state, fulfillment state
- `messaging`: channel threads, inbound intent capture, sales handoff, recovery flows
- `localization`: locale, currency, formatting, business defaults, UAE-friendly presentation rules
- `verification`: inspections, grading, trust badges, warranty data

### Extension Principle

If a field only applies to one category, it must not enter the core model unless it is represented as:

- a category attribute
- a verification template field
- or an extension entity

Phone-specific examples:

- IMEI
- battery health
- face ID check

These belong in category-specific verification or attribute structures.

## 5. Execution Plan

### Phase 1: New Platform Core

Goal:
define the platform on its own terms before importing legacy logic

Work:

- establish new repo and domain boundaries
- define generic entities and state models
- define migration rules from legacy sources
- set naming that is not Makful-specific

Deliverable:
a clean platform codebase with stable domain contracts

Phase 1 success means:

- canonical product and offering model
- inventory movement ledger
- authoritative order creation path
- authoritative order transition path
- truthful order event trail

### Phase 2: Legacy Logic Intake

Goal:
copy only the proven parts from the existing apps

Work:

- port order state transitions from `order-management-backend`
- port payment and webhook hardening from `order-management-backend`
- port reservation UX patterns from `makful-app`
- port inspection concepts from `makful-app` as category templates

Deliverable:
reused production logic inside the new architecture

### Phase 3: First Tenant Launch

Goal:
stand up Makful as the first tenant on the new platform

Work:

- create seller-level storefront configuration
- map Makful catalog and branding into seller settings
- run phone verification as a category template
- keep Makful-specific UX outside the platform core

Deliverable:
Makful running as a tenant, not as the platform definition

### Phase 4: Category Expansion

Goal:
prove the platform is not locked to phones

Work:

- add a second category template
- support category attribute sets
- support inspection policies by category
- validate shared order and payment flows still hold
- validate shared quote and messaging flows still hold

Candidate categories:

- refurbished electronics
- appliances
- furniture
- auto parts
- service or installation businesses

Deliverable:
at least two categories using the same platform core

### Phase 5: UAE Commerce Differentiation

Goal:
build the features that generic platforms usually miss in this market

Work:

- bilingual seller and storefront support
- WhatsApp-first lead and order journeys
- quote, invoice, and deposit workflows
- COD and manual-invoice capable payment policies
- warranty and trust communication in customer-facing flows

Deliverable:
a product with real UAE market differentiation instead of generic ecommerce parity

### Phase 6: Commercial Platformization

Goal:
make seller onboarding repeatable

Work:

- seller setup flow
- role and staff permissions
- branded storefront settings
- fulfillment and notification automation
- analytics and audit reporting

Deliverable:
a reusable seller platform instead of a custom project

## 6. What We Copy vs What We Rebuild

### Copy And Adapt

- hardened order status transition logic
- payment confirmation and webhook handling
- inventory decrement and race-condition protection
- reservation creation patterns
- admin login and operational controls
- inspection and warranty concepts
- conversational sales patterns
- quote and invoice flow ideas from reference products

### Rebuild Cleanly

- core schema
- tenant model
- category model
- product attribute strategy
- public API contracts
- frontend shell for multi-tenant storefronts

## 7. Recommended Build Order

1. Define core types and bounded contexts.
2. Define migration map from both legacy apps.
3. Implement authoritative order creation and inventory reservation.
4. Implement authoritative order transitions and inventory release/deduct flows.
5. Port payment rules into new services only after the order lifecycle is stable.
6. Add quote, invoice, and messaging contracts.
7. Add sourcing and AI enrichment contracts.
8. Add opportunity scoring and autonomous publish contracts.
9. Add category templates and verification contracts.
10. Add workflow orchestration and autonomous operations loops.
11. Implement Makful as tenant one.
12. Add a second category before calling the architecture stable.

## 8. Success Criteria

- one platform core supports multiple seller types
- Makful runs without owning platform-specific logic
- phone-only fields do not leak into the generic core
- orders and payments have one authoritative state machine
- order lifecycle is authoritative before payment automation is added
- quotes and messaging can feed the same commerce engine
- supplier imports can feed draft listings without bypassing review
- opportunity scoring can rank products before catalog publication
- a second category can launch without schema surgery

## 9. Next Implementation Targets

- persistent entities and repository interfaces
- generic order and payment state machine services
- quote conversion services
- messaging orchestration services
- UAE localization defaults
- category template registry
- seller storefront configuration model
- legacy migration scripts and adapters
