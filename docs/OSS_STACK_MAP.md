# Open Source Stack Map

## Purpose

This document maps the selected open-source projects to Sellora's current scaffold so implementation can proceed without drifting.

## Primary Selections

### Workflow Backbone

- Temporal

Sellora mapping:

- `src/ports/workflow-engine.ts`
- `src/adapters/temporal/temporal-workflow-engine.ts`
- `src/domain/autonomy/workflow.ts`
- `src/modules/workflows/sellora-workflow-catalog.ts`

Use for:

- discovery loop orchestration
- publish loop orchestration
- order-to-delivery orchestration
- retries and waiting on external events

### Agent Runtime

- Mastra

Sellora mapping:

- `src/adapters/mastra/mastra-agent-runtime.ts`
- `src/domain/autonomy/agent-runtime.ts`
- `src/domain/autonomy/action.ts`

Use for:

- scout agent
- analyst agent
- merchandiser agent
- sales and ops assistance

### Browser Automation

- Stagehand

Sellora mapping:

- `src/ports/browser-automation.ts`
- `src/adapters/stagehand/stagehand-browser-automation.ts`
- `src/application/discovery/discovery-orchestrator.ts`

Use for:

- approved web source extraction
- recurring source checks
- structured product discovery where APIs do not exist

### Messaging

- Chatwoot

Sellora mapping:

- `src/ports/messaging-gateway.ts`
- `src/adapters/chatwoot/chatwoot-messaging-gateway.ts`
- `src/domain/messaging/conversation.ts`

Use for:

- WhatsApp-centered conversation flows
- customer follow-up
- conversational sales operations

### Shipping

- Karrio

Sellora mapping:

- `src/ports/shipping-gateway.ts`
- `src/adapters/karrio/karrio-shipping-gateway.ts`

Use for:

- booking
- tracking
- shipment status normalization

### Event Reliability

- Convoy or Hookdeck Outpost

Sellora mapping:

- `src/ports/event-bus.ts`
- `src/adapters/convoy/convoy-event-bus.ts`
- `src/domain/events/event-envelope.ts`
- `src/modules/events/idempotency.ts`

Use for:

- inbound and outbound event reliability
- webhook retries
- idempotent event delivery

## Existing Build Reuse

### From `order-management-backend`

Reuse ideas and logic for:

- order state transitions
- payment attempts
- order events
- stock protection patterns

Target areas:

- `src/modules/orders`
- future repository and service layer

### From `makful-app`

Reuse ideas and logic for:

- reservation-driven conversion
- high-trust product presentation
- inspection and warranty logic
- operational flow from payment to delivery

Target areas:

- `src/domain/verification`
- future storefront and operator workflows

## Implementation Order

1. Temporal adapter and one workflow path
2. Stagehand adapter and one source extraction flow
3. repository layer for SourceListing and Opportunity
4. autonomous publish service persistence
5. Chatwoot and Karrio integration points

## Rule

No external framework should change the core domain model.
All integrations enter Sellora through ports and adapters.
