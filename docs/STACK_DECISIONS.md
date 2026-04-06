# Sellora Stack Decisions

## 0. Assumptions

- Sellora should be autonomous, but the stack must remain replaceable by interface.
- We are selecting primary implementation targets, not permanently locking to one vendor or framework.
- Durable execution, browser automation, messaging, shipping, and event delivery must be first-class concerns.

## 1. Recommended Core Stack

### Durable Workflows

Primary choice:

- Temporal

Reason:

- best fit for long-running retry-safe business workflows
- strong model for order-to-delivery orchestration
- explicit workflow and activity boundaries

### Agent Runtime

Primary choice:

- Mastra

Reason:

- TypeScript fit
- useful for agent composition and tools
- easier alignment with the current repo language choice

Fallback:

- LangGraph when graph-heavy orchestration is needed

### Browser Automation

Primary choice:

- Stagehand

Reason:

- good fit for repeatable browser-driven extraction and action
- clean path for controlled source automation where APIs do not exist

Fallback:

- browser-use for broader agent-browser experimentation

### Messaging

Primary choice:

- Chatwoot integration

Reason:

- omnichannel patterns
- WhatsApp-aligned customer operations
- support and sales thread handling

### Shipping

Primary choice:

- Karrio integration

Reason:

- carrier abstraction
- useful shipping and tracking boundary

### Webhook Reliability

Primary choice:

- Convoy-compatible event delivery boundary

Reason:

- delivery retries
- observability
- idempotent event handling patterns

## 2. Rules

1. No framework should leak through the domain model.
2. All external systems must be represented through ports.
3. Autonomy decisions must pass through policy gates before execution.
4. Event-driven actions must be idempotent.
5. Every autonomous action must have an audit trail.
