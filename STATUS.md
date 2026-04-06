# Sellora Status Memo

## Classification
**Commerce operating kernel in scaffolded form**  
Architecture direction validated, authoritative lifecycle spine incomplete.

## What is Real ✅

### Core Architecture
- **Authoritative schema foundation** with tenant isolation
- **Category-agnostic core** with template-driven extensions
- **Prisma-backed truth model** with proper relationships
- **Multi-stage Docker deployment** with health checks
- **Test isolation** (unit vs integration) with smoke gates

### Production Readiness
- **Health/ready endpoints** serving correctly
- **Database migrations** applying cleanly
- **Authenticated reconcile API** functional
- **Deployment automation** (Render, smoke script)

## What is Scaffold Only ⚠️

### Order Lifecycle
- **State machine incomplete** — transitions not fully authoritative
- **Inventory mutations** not hardened (release/deduct discipline missing)
- **Event trail** lacks full idempotency guarantees
- **Cancellation flow** not integrated with inventory release

### Payment Core
- **Payment attempts** tracked but not transactionally consistent
- **Webhook handling** exists but not tied to order truth
- **Refund/chargeback paths** not implemented

### Tenant Operations
- **Makful as tenant** conceptually correct
- **WhatsApp/storefront flows** not yet terminating into kernel
- **Operator tools** not built

## What Must Be Built Next 🎯

### Phase 1: Hardened Kernel
1. **Complete authoritative order transition service**
   - All state changes through single transition authority
   - Guard conditions and invariants enforced
   - Atomic state + event persistence

2. **Inventory discipline**
   - Release inventory on cancellation
   - Deduct inventory on fulfillment
   - Prevent overselling with reservation windows

3. **Truthful event trail**
   - All order mutations emit canonical events
   - Idempotent event processing
   - Audit trail reconstruction capability

4. **Payment core integration**
   - Transactional payment attempts
   - Payment webhook reconciliation
   - Refund/chargeback handling

### Phase 2: Tenant Operations
5. **Quote/invoice/messaging paths**
   - All flows terminate into same order truth
   - WhatsApp integration as first-class channel
   - Arabic/English localization

6. **First tenant operational flow**
   - End-to-end order lifecycle
   - Inventory management
   - Payment reconciliation

## What Should Be Explicitly Deferred 🚫

### Sourcing/Autonomy Loop
- **Source discovery automation**
- **Normalization/enrichment pipelines**
- **Scoring and policy gates**
- **Opportunity engine**

> **Rationale:** These are attractive but distract from kernel hardening. They become Phase 3 after authoritative operations are proven.

## Technical Debt to Address

### Immediate
- **Complete order state machine** in `TransitionOrderService`
- **Add inventory mutations** to transition side effects
- **Implement payment transaction consistency**
- **Add comprehensive event coverage**

### Medium
- **Operator dashboard** for tenant management
- **Advanced policy engine** (post-kernel)
- **Multi-tenant isolation hardening**

## Success Metrics

### Kernel Hardening
- [ ] All order changes go through `TransitionOrderService`
- [ ] Inventory never leaks (release/deduct atomic)
- [ ] Events can reconstruct order state exactly
- [ ] Payments reconcile to order truth

### Tenant Operations
- [ ] Complete order flow via WhatsApp
- [ ] Arabic/English localization working
- [ ] Makful tenant operational at scale

## Architectural Principles Maintained

✅ **Single source of truth** for orders, payments, inventory  
✅ **Category-agnostic core** with template extensions  
✅ **Tenant isolation** with proper authorization  
✅ **Event-driven design** with audit trail  
✅ **Deployment automation** with smoke gates  

## Risk Assessment

**High Risk:** Priority dilution — attractive sourcing features may distract from kernel completion  
**Medium Risk:** Inventory consistency under concurrent operations  
**Low Risk:** Schema foundation (solid)

---

*Last updated: 2026-04-07*  
*Next review: After Phase 1 kernel hardening*
