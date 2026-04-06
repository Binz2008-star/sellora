# Migration Copy Map

## 0. Assumptions

- We are not merging entire repositories.
- We are copying proven logic into new platform modules.
- The new platform must stay category-agnostic at the core.
- Legacy repos remain reference implementations until the new platform replaces them.

## 1. Source Repositories

### `order-management-backend`

Primary value:

- multi-seller model
- seller-scoped products and orders
- hardened order transitions
- payment attempt tracking
- webhook handling
- production verification patterns

### `makful-app`

Primary value:

- reservation-first purchase flow
- high-trust product presentation
- category-specific verification for devices
- shipment and post-payment operations
- branded storefront behavior

## 2. Copy Strategy

### Copy From `order-management-backend`

- auth and seller boundary patterns
- order transition logic
- order event logging
- payment attempt model ideas
- webhook idempotency patterns
- stock protection and transaction boundaries

Suggested source areas:

- `src/server/services/order.service.ts`
- `src/server/services/order-transition.service.ts`
- `src/server/services/order-transitions.ts`
- `src/server/services/payment.service.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/public/[sellerSlug]/orders/route.ts`
- `src/app/api/public/[sellerSlug]/products/route.ts`

### Copy From `makful-app`

- reservation flow behavior
- storefront UX expectations
- category-specific inspection concepts
- shipment model ideas
- deposit payment concepts

Suggested source areas:

- `src/server/actions/createReservation.ts`
- `src/app/api/reserve/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/admin/operations/route.ts`
- `prisma/schema.prisma`

## 3. Do Not Copy Directly

- legacy Prisma schemas as-is
- product naming tied to phones
- direct database writes from frontend-specific actions
- duplicated payment truth across systems
- repo-local environment assumptions
- generated build artifacts

## 4. New Platform Mapping

### Seller And Staff

Use:

- seller ownership and staff roles from `order-management-backend`

Do not carry:

- category-specific admin assumptions from `makful-app`

### Product Catalog

Use:

- seller-scoped product ownership from `order-management-backend`
- rich condition and inspection data concepts from `makful-app`

Rebuild as:

- generic `Product`
- category `ProductAttributes`
- media
- pricing
- inventory

### Orders

Use:

- backend transaction handling and event creation
- Makful reservation entry point

Rebuild as:

- generic order aggregate with support for:
  - single-item reserved products
  - multi-item cart orders
  - deposit or full-payment flows

### Payments

Use:

- backend payment attempt and webhook hardening
- Makful deposit workflow rules

Rebuild as:

- one payment domain with configurable payment policies by seller or category

### Verification

Use:

- Makful inspection concepts

Rebuild as:

- template-driven verification system
- category-specific checks defined outside the core entities

## 5. Initial Copy Sequence

1. Port order status definitions and transition rules.
2. Port payment attempt lifecycle and webhook idempotency.
3. Port reservation flow into a generic order creation service.
4. Extract Makful phone checks into a category template.
5. Add shipment support as a generic fulfillment extension.

## 6. Acceptance Rule For Copied Code

Code may be copied only if:

- it solves a real platform problem
- it does not import legacy product assumptions
- it fits the new domain names
- it can be tested in isolation

If not, rebuild it cleanly instead of porting it.
