# Autonomy Guardrails

## 0. Assumptions

- The system may operate without routine human approval.
- A no-human-loop system still needs hard safety controls.
- Kill switches, source allowlists, and risk thresholds are mandatory.

## 1. Mandatory Guardrails

- global autonomy kill switch
- seller-level autonomy enablement
- source allowlist
- category allowlist
- minimum margin threshold
- maximum risk threshold
- duplicate detection before publish
- stock confidence checks
- pricing floor and ceiling rules
- audit event for every autonomous action

## 2. Hard Stops

Sellora must not autonomously:

- publish from blocked sources
- publish when risk exceeds policy
- accept impossible margin estimates
- keep listings live when inventory confidence collapses
- move an order to fulfilled without shipment evidence
- retry failed actions forever

## 3. Required Recovery Paths

- retry transient failures
- pause on repeated extraction failure
- unpublish on stock drift
- reprice on source cost drift
- park workflows awaiting external events
- fail closed when policy is unclear
