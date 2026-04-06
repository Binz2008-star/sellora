# Hardening Notes

## Current Strengths

- domain model is category-agnostic
- commerce kernel has started moving toward `Product` plus `ProductOffering` plus `InventoryMovement`
- autonomous workflows are now explicit
- policy gates and kill switch concepts exist
- sourcing and opportunity scoring are modeled separately from catalog publishing
- messaging, quotes, orders, and fulfillment are all represented in the architecture
- persistence contracts and Prisma-backed repositories exist for the first autonomy slice

## Gaps Before Runtime

- no Temporal workflows are scaffolded yet
- no Mastra agent runtime is scaffolded yet
- no Stagehand connector implementation exists yet
- no Chatwoot, Karrio, or Convoy adapters exist yet
- no duplicate detection implementation exists yet
- no pricing or landed-cost engine exists yet
- no event persistence or webhook ingestion implementation exists yet

## Hardening Priorities

1. Add repository and persistence boundaries.
2. Add explicit workflow runner implementations.
3. Add one concrete source extraction connector.
4. Persist event envelopes and webhook ingestion.
5. Add duplicate detection and listing pause rules.
6. Add inventory drift and auto-unpublish policies.
