# Tenant One Implementation Spec

## Tenant

Tenant one is **Makful**, but only as:

- seller configuration
- category template assignment
- storefront defaults
- operational workflow settings

Makful must not introduce platform-special-case business logic.

## Objective

Prove one complete seller business loop on the existing Sellora kernel:

seller setup -> catalog live -> lead or order capture -> inventory reservation -> payment state -> fulfillment -> delivery -> audit trail

## Scope

### In Scope

- seller bootstrap and storefront configuration
- manual catalog draft and publish flow
- direct order capture
- quote creation and quote-to-order conversion
- authoritative order creation and reservation
- lifecycle transitions, cancel, release, fulfill, deduct
- payment progression on top of the lifecycle authority
- seller operational inbox and order timeline
- delivery confirmation and post-delivery operational message

### Explicitly Deferred

- full supplier automation loop
- opportunity engine as primary business flow
- multi-category rollout beyond tenant-one category
- advanced analytics
- multi-instance infra redesign
- native apps

## Existing Kernel To Reuse

The following capabilities already exist and must be reused, not rebuilt:

- authoritative order lifecycle
- inventory movement discipline
- payment service and payment state machine
- fulfillment booking and delivery confirmation
- shipping webhook sync and reconciliation
- notification fanout baseline
- seller-scoped operator endpoints
- order timeline and operational query surfaces

## Required New Surfaces

1. operator tenant setup
2. seller catalog draft and publish
3. seller storefront
4. quote and direct order submission
5. seller operations dashboard
6. order detail timeline and action view

## Domain Entities

### Reused Core Entities

- `Seller`
- `StorefrontSettings`
- `StaffMembership`
- `CategoryTemplate`
- `Product`
- `ProductOffering`
- `Customer`
- `Quote`
- `QuoteLine`
- `Order`
- `OrderLine`
- `InventoryMovement`
- `PaymentAttempt`
- `FulfillmentRecord`
- `OrderEvent`
- `NotificationLog`
- `ConversationThread`
- `ConversationMessage`

### Tenant-One Configuration Expectations

Makful tenant configuration must include:

- seller identity and slug
- default locale configuration
- default currency
- Arabic and English availability
- WhatsApp-first channel enablement
- verified resale category template assignment
- trust and warranty presentation settings

## Routes

## Operator Setup Routes

### `POST /api/tenants`

Create a seller tenant with:

- seller identity
- storefront defaults
- locale configuration
- category template assignment

### `POST /api/tenants/:sellerId/staff`

Assign staff users and permissions.

### `PATCH /api/tenants/:sellerId/storefront`

Update storefront settings, branding, locale, and trust defaults.

## Catalog Routes

### `POST /api/catalog/drafts`

Create manual draft product and offering.

### `PATCH /api/catalog/drafts/:productId`

Edit product draft and offering details.

### `POST /api/catalog/drafts/:productId/publish`

Publish a validated listing into the seller storefront.

### `GET /api/storefront/:sellerSlug/products`

Public storefront product listing.

### `GET /api/storefront/:sellerSlug/products/:productSlug`

Public storefront product detail.

## Quote and Order Capture Routes

### `POST /api/storefront/:sellerSlug/quotes`

Create a quote request from storefront or operator-assisted entry.

### `POST /api/storefront/:sellerSlug/orders`

Create a direct order from a storefront flow.

### `POST /api/quotes/:quoteId/approve`

Approve quote and convert it into an authoritative order.

### `POST /api/quotes/:quoteId/reject`

Reject quote with audit event.

## Operations Routes

### `GET /api/ops/inbox`

Unified seller operational inbox containing:

- quote requests
- unpaid payment states
- pending orders
- verification-required items
- fulfillment-ready orders

### `GET /api/orders/:orderId`

Existing order detail surface.

### `GET /api/orders/:orderId/timeline`

Existing truthful event timeline.

### `GET /api/orders/:orderId/fulfillment`

Existing fulfillment visibility route.

## Payment Routes

### `POST /api/payments/attempts`

Existing payment initiation path.

### `POST /api/payments/webhooks/generic`

Existing payment event ingress path.

## Fulfillment Routes

### `POST /api/fulfillment/shipments/book`

Existing shipment booking authority.

### `POST /api/fulfillment/deliveries/confirm`

Existing delivery confirmation authority.

### `POST /api/fulfillment/webhooks/karrio`

Existing shipping webhook ingress.

### `POST /api/fulfillment/shipments/reconcile`

Existing shipment reconcile authority.

## State Transitions

## Listing States

### Product

- `DRAFT -> ACTIVE`
- `ACTIVE -> INACTIVE`
- `INACTIVE -> ACTIVE`
- `ACTIVE|INACTIVE -> ARCHIVED`

Tenant one only requires draft and publish to be operational.

## Quote States

- `DRAFT -> SENT`
- `SENT -> APPROVED`
- `SENT -> REJECTED`
- `SENT -> EXPIRED`
- `APPROVED -> CONVERTED`

Rule:
quote approval must terminate into the same authoritative order creation path used by direct order capture.

## Order Lifecycle

The tenant-one implementation must continue to use the existing order authority. The relevant operational path is:

- direct capture or quote conversion -> authoritative order creation
- reserve inventory on create
- `PENDING_PAYMENT|RESERVED -> CONFIRMED`
- `CONFIRMED -> SHIPPED`
- `SHIPPED -> DELIVERED`
- `CONFIRMED -> CANCELLED`
- `CONFIRMED -> EXPIRED`

Inventory rules:

- reserve on order creation
- release on cancellation or expiry
- deduct on fulfillment settlement according to the existing authority path

## Payment Lifecycle

- `PENDING -> PROCESSING`
- `PROCESSING -> PAID`
- `PROCESSING -> FAILED`

Rules:

- payment must not mutate order state directly outside the lifecycle authority
- payment success may request lifecycle transition only through the existing authority path
- payment failure must not regress a more advanced order state

## Fulfillment Lifecycle

- booking initiated
- shipment booked
- shipped
- delivered
- reconciled if provider status arrives late or webhook is missed

## Dashboard Screens

## 1. Operator Tenant Setup

Purpose:

- create seller tenant
- assign locale defaults
- enable category template
- create staff roles

Required fields:

- seller display name
- seller slug
- default currency
- locale support
- WhatsApp enablement
- category template assignment

## 2. Seller Catalog Draft and Publish

Purpose:

- create manual drafts
- review product data
- publish approved listing

Required visibility:

- draft listings
- publish action
- trust and warranty fields
- category-specific attributes

## 3. Seller Storefront

Purpose:

- expose active listings under seller branding
- support Arabic and English presentation
- expose direct inquiry, quote, or order action

## 4. Quote and Direct Order Submission

Purpose:

- customer submits quote or direct order
- capture customer name, phone, address, and selected item
- choose payment path where applicable

## 5. Seller Operations Dashboard

Purpose:

- one inbox for quotes, unpaid flows, pending orders, and fulfillment-ready orders

Required widgets:

- new quotes
- unpaid or pending payment orders
- fulfillment-ready orders
- delivery follow-up items

## 6. Order Detail Timeline

Purpose:

- show authoritative order state
- show payment progression
- show fulfillment progression
- show truthful event sequence

## Required Domain Events

- tenant created
- listing drafted
- listing published
- quote created
- quote approved
- quote rejected
- order created
- inventory reserved
- payment initiated
- payment confirmed
- payment failed
- order status changed
- shipment booked
- shipment updated
- delivered
- inventory released
- inventory deducted

## MVP Acceptance Tests

## Tenant Setup

- operator can create seller tenant with storefront defaults
- operator can assign at least one staff member
- Makful-specific settings exist only in config and templates, not hardcoded business logic

## Catalog

- seller can create draft listing manually
- seller can publish draft listing to storefront
- storefront shows published listing under seller slug
- Arabic and English storefront copy resolve correctly for tenant-one fields

## Quote and Order Capture

- customer can submit a quote request without staff intervention
- customer can submit a direct order without staff intervention
- approved quote converts into an authoritative order
- direct order and quote-converted order both hit the same authoritative order creation path

## Order and Inventory

- authoritative order creation reserves inventory exactly once
- cancelling a confirmed order releases inventory exactly once
- invalid order transitions are rejected with no side effects
- order timeline contains truthful order and inventory events

## Payment

- payment initiation creates payment truth without direct order mutation
- payment confirmation advances lifecycle only through authority
- payment failure does not regress advanced order state
- payment events are single-write and visible in the order timeline or operational view

## Fulfillment

- seller can book shipment through the authority path
- delivery confirmation updates order and fulfillment truth together
- reconcile flow succeeds for a drifted or delayed shipping status
- fulfillment state is visible in seller operations

## Post-Delivery

- delivered order logs final delivery event
- post-delivery trust or warranty message can be triggered operationally
- outcome is visible in the seller operational view

## Tenant-One Definition Of Done

Tenant one is complete only when all of the following are true:

- Makful runs as seller configuration and category template set only
- one seller can publish products without direct database manipulation
- one customer can create quote or direct order through tenant-facing flow
- authoritative order creation reserves inventory correctly
- authoritative transitions govern order progression
- payment lifecycle does not fork commerce truth
- fulfillment updates remain visible and truthful
- bilingual tenant-facing presentation works
- order timeline is complete and auditable
- storefront and operations surfaces read from the same commerce truth

## Delivery Sequence

1. tenant setup and storefront configuration
2. manual catalog draft and publish
3. quote and direct order capture
4. authoritative order creation and reservation
5. lifecycle transitions and truthful timeline
6. payment path integration
7. fulfillment and delivery completion
8. post-delivery trust or warranty handoff

## Decision Rule

Do not expand sourcing, autonomy, or category breadth until tenant one completes the full business loop above on top of the existing authority model.
