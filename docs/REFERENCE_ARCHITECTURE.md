# Sellora Reference Architecture

## 0. Assumptions

- This document captures architectural inspiration, not direct code-copy instructions.
- The target market is UAE sellers operating across Arabic and English channels.
- Reference projects are used to identify proven patterns and product gaps.

## 1. Primary Product Thesis

Build a UAE-native commerce operating system that combines:

- storefronts
- messaging-led conversion
- AI-assisted sourcing
- quotes and invoices
- orders and payments
- fulfillment and after-sales trust

The goal is not to clone an existing ecommerce platform. The goal is to combine strong commerce architecture with regional workflows that are usually under-served.

## 2. Key Reference Projects

### Medusa

Use as reference for:

- modular service design
- pragmatic TypeScript implementation
- extensible commerce core

### Vendure

Use as reference for:

- admin and shop separation
- plugin-friendly architecture
- extensibility around commerce entities

### Saleor

Use as reference for:

- multi-channel commerce thinking
- mature order and payment architecture
- serious production boundaries

### VTEX B2B Quotes

Use as reference for:

- quote lifecycle
- approvals
- conversion from quote to order

### Chatwoot and Chaskiq

Use as reference for:

- conversational commerce
- omnichannel support
- human handoff and lead recovery

### Temporal

Use as reference for:

- durable workflow orchestration
- retry-safe long-running business processes
- event-driven order and fulfillment execution

### LangGraph and Mastra

Use as reference for:

- agent orchestration patterns
- tool-using autonomous workflows
- multi-step AI runtime coordination

### Stagehand and Browser-Use

Use as reference for:

- browser automation for discovery and extraction
- action execution against web sources where APIs do not exist

### Karrio and Convoy

Use as reference for:

- shipment and carrier integration patterns
- webhook delivery, retries, and event reliability

### Invoicerr

Use as reference for:

- quote and invoice documents
- billing workflows
- lightweight operational simplicity

### Approved Source Connector Ecosystem

Use as reference for:

- supplier product import
- connector-based integration paths
- structured feed ingestion
- browser-assisted extraction where APIs do not exist

## 3. Differentiation To Build

The platform should make these workflows first-class:

- WhatsApp-first selling
- Arabic and English support
- quote to order to invoice in one system
- supplier to draft listing with AI enrichment
- deposit and manual-invoice payment policies
- verification and warranty visibility
- seller operations for social commerce, not just online checkout

## 4. Architecture Implications

The core platform must include:

- seller tenancy
- category templates
- quote lifecycle
- order lifecycle
- payment attempt orchestration
- supplier import jobs
- policy gating before autonomous publishing
- autonomous workflow runs
- agent policy execution
- messaging threads and channel metadata
- warranty and verification entities
- localization defaults for UAE commerce

## 5. Rules For Implementation

1. Do not let storefront assumptions define the backend core.
2. Do not let phone-resale assumptions define the product model.
3. Do not make WhatsApp a late-stage integration.
4. Do not bolt Arabic support on after the data model is already fixed.
5. Keep quote, order, and invoice states connected through explicit transitions.
