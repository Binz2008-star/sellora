# Sellora Next Phase Plan

## Objective

Move Sellora from a production-sealed single-instance commerce kernel into a repeatable seller platform without breaking the authority model that has already been proven.

## Current Baseline

The following are already real and verified:

- authoritative order lifecycle
- payment lifecycle
- fulfillment booking, delivery, and reconciliation
- hosted health and readiness checks
- single-instance production deployment on Render
- operational runbook and monitoring baseline

This means the next phase is not kernel invention. It is controlled platform expansion.

## Phase Goal

Deliver one complete tenant-ready operating flow on top of the existing kernel, while proving the architecture can support category expansion without schema drift.

## Priority Order

1. tenantization of the current backend
2. quote, invoice, and messaging flow integration
3. second category proof
4. operational hardening beyond manual runbook checks

## Workstream 1: First Tenant Flow

### Goal

Make the current kernel usable as a tenant-backed seller system instead of a sealed backend service only.

### Deliverables

- seller setup flow
- seller-scoped operational defaults
- tenant-facing storefront or operator configuration hooks
- documented first-tenant onboarding path

### Success Criteria

- a new seller can be provisioned without direct database editing
- seller-scoped configuration is persisted and queryable
- operational flows remain seller-isolated

## Workstream 2: Commerce Path Integration

### Goal

Connect quote, invoice, and messaging flows into the same authoritative commerce truth already used by orders, payments, and fulfillment.

### Deliverables

- quote-to-order conversion path
- invoice linkage into the commerce lifecycle
- messaging capture that terminates into quotes or orders
- idempotent event coverage for the new paths

### Success Criteria

- quotes do not create parallel truth
- invoices do not bypass the order and payment model
- messaging can create or advance a commercial object without side-channel mutations

## Workstream 3: Category Expansion

### Goal

Prove the platform is not locked to one category shape.

### Deliverables

- second category template
- category-specific attributes outside the core schema
- category-specific verification template
- validation that shared order and payment flows still hold

### Success Criteria

- second category launches without schema surgery
- no phone-specific assumptions leak into core entities
- shared flows continue to operate unchanged

## Workstream 4: Operational Maturity

### Goal

Reduce operational risk beyond manual smoke verification.

### Deliverables

- alert wiring for health, readiness, and reconcile failures
- incident playbook
- provider failure handling checklist
- secret rotation runbook

### Success Criteria

- operator can detect and react to failure without code inspection
- common incidents have a documented response path
- provider outages do not create undefined handling

## Explicit Deferrals

Do not prioritize these before the workstreams above are complete:

- broad sourcing expansion
- richer autonomy loops
- multi-instance re-architecture
- marketplace breadth
- analytics-heavy product expansion

## Delivery Sequence

### Step 1

Tenant onboarding and seller configuration baseline

### Step 2

Quote and invoice integration into the existing authority model

### Step 3

Messaging path into commercial objects

### Step 4

Second category rollout

### Step 5

Alerting and incident operations baseline

## Decision Rule

Do not promote a new major subsystem until the current one terminates cleanly into the same commerce truth model.

## Bottom Line

Sellora does not need a new architecture phase next.

It needs disciplined platformization on top of the verified kernel, with tenant flow, category proof, and operational maturity delivered in that order.
