# Sellora Module Migration List

## **Action Required: Remove Overlap & Align with Platform Role**

**Effective: 2026-04-08**

---

## **MODULES TO DELETE (Runtime Overlap)**

### **Order Domain Modules**
- `src/domain/orders/` - DELETE (runtime owns orders)
- `src/modules/orders/` - DELETE (runtime owns order logic)
- `src/services/order.service.ts` - DELETE (duplicate)
- `src/services/order-transition.service.ts` - DELETE (runtime owns transitions)

### **Payment Domain Modules**
- `src/domain/payments/` - DELETE (runtime owns payments)
- `src/services/payment.service.ts` - DELETE (duplicate)
- `src/services/payment-attempt.service.ts` - DELETE (runtime owns payment attempts)

### **Authentication Domain Modules**
- `src/domain/auth/` - DELETE (runtime owns auth)
- `src/services/auth.service.ts` - DELETE (duplicate)
- `src/lib/auth.ts` - DELETE (runtime owns authentication)

### **Audit/Event Domain Modules**
- `src/domain/events/` - DELETE (runtime owns audit events)
- `src/services/order-event.service.ts` - DELETE (runtime owns events)
- `src/services/audit.service.ts` - DELETE (duplicate)

### **Inventory Domain Modules**
- `src/domain/inventory/` - DELETE (runtime owns inventory mutations)
- `src/services/inventory.service.ts` - DELETE (duplicate)
- `src/modules/inventory-ledger.ts` - DELETE (runtime owns stock)

---

## **MODULES TO KEEP (Platform Role)**

### **Catalog Management**
- `src/domain/catalog/` - KEEP (platform owns catalog)
- `src/modules/catalog/` - KEEP (platform catalog logic)
- `src/services/catalog.service.ts` - KEEP (catalog management)

### **AI Sourcing**
- `src/domain/sourcing/` - KEEP (platform owns sourcing)
- `src/modules/sourcing/` - KEEP (AI sourcing logic)
- `src/services/sourcing.service.ts` - KEEP (supplier import)

### **Opportunity Engine**
- `src/domain/opportunities/` - KEEP (platform owns opportunities)
- `src/modules/opportunity-engine.ts` - KEEP (profit discovery)
- `src/services/opportunity.service.ts` - KEEP (scoring logic)

### **Autonomous Workflows**
- `src/domain/autonomy/` - KEEP (platform owns workflows)
- `src/modules/workflow-engine.ts` - KEEP (automation)
- `src/services/workflow.service.ts` - KEEP (policy engines)

### **Platform Integration**
- `src/domain/integration/` - KEEP (platform owns integrations)
- `src/modules/whatsapp-integration.ts` - KEEP (messaging)
- `src/services/integration.service.ts` - KEEP (third-party APIs)

### **Localization**
- `src/domain/localization/` - KEEP (platform owns localization)
- `src/modules/arabic-support.ts` - KEEP (Arabic/English)
- `src/services/localization.service.ts` - KEEP (translation)

---

## **MODULES TO CONVERT (Runtime API Clients)**

### **Order Consumption**
- `src/services/runtime-order-client.ts` - CREATE (consume runtime order APIs)
- `src/lib/runtime-client.ts` - CREATE (general runtime API client)

### **Payment Consumption**
- `src/services/runtime-payment-client.ts` - CREATE (consume runtime payment APIs)
- `src/lib/payment-webhook-client.ts` - CREATE (handle payment webhooks from runtime)

### **Authentication Consumption**
- `src/services/runtime-auth-client.ts` - CREATE (consume runtime auth APIs)
- `src/lib/auth-middleware.ts` - CONVERT (use runtime auth validation)

---

## **DATABASE SCHEMA CHANGES**

### **Tables to Remove**
- `orders` - DELETE (runtime owns)
- `payments` - DELETE (runtime owns)
- `payment_attempts` - DELETE (runtime owns)
- `users` - DELETE (runtime owns)
- `order_events` - DELETE (runtime owns)
- `inventory` - DELETE (runtime owns)

### **Tables to Keep**
- `products` - KEEP (platform owns catalog)
- `categories` - KEEP (platform owns categories)
- `suppliers` - KEEP (platform owns sourcing)
- `source_listings` - KEEP (platform owns sourcing data)
- `opportunities` - KEEP (platform owns opportunities)
- `autonomy_policies` - KEEP (platform owns workflows)
- `workflow_runs` - KEEP (platform owns automation)
- `integration_configs` - KEEP (platform owns integrations)

---

## **API ENDPOINT CHANGES**

### **Endpoints to Remove**
- `POST /api/orders` - DELETE (runtime owns)
- `PATCH /api/orders/:id/status` - DELETE (runtime owns)
- `POST /api/payments` - DELETE (runtime owns)
- `POST /api/auth/login` - DELETE (runtime owns)
- `GET /api/orders/:id/events` - DELETE (runtime owns)

### **Endpoints to Keep**
- `GET /api/catalog/products` - KEEP (platform owns)
- `POST /api/catalog/import` - KEEP (platform owns)
- `GET /api/sourcing/opportunities` - KEEP (platform owns)
- `POST /api/workflows/execute` - KEEP (platform owns)
- `POST /api/integrations/whatsapp` - KEEP (platform owns)

### **Endpoints to Create (Runtime Clients)**
- `POST /api/platform/orders` - CREATE (proxy to runtime)
- `GET /api/platform/payments/:id/status` - CREATE (proxy to runtime)
- `POST /api/platform/auth/validate` - CREATE (proxy to runtime)

---

## **MIGRATION PRIORITY**

### **Phase 1: Critical (Immediate)**
1. **DELETE** all order/payment/auth modules
2. **REMOVE** overlapping database tables
3. **STOP** all runtime-domain API endpoints

### **Phase 2: High Priority**
1. **CREATE** runtime API clients
2. **CONVERT** existing platform logic to use runtime APIs
3. **UPDATE** database schema to remove overlap

### **Phase 3: Medium Priority**
1. **OPTIMIZE** API consumption patterns
2. **ADD** error handling for runtime API calls
3. **UPDATE** documentation and tests

---

## **SUCCESS CRITERIA**

### **Complete Migration When:**
- [ ] No order/payment/auth logic in sellora
- [ ] All catalog/sourcing/workflow logic intact
- [ ] Runtime API clients functional
- [ ] Database schema cleaned
- [ ] API endpoints aligned with platform role
- [ ] Tests pass with new architecture

---

## **RISKS & MITIGATION**

### **High Risk**
- **Breaking existing platform workflows** - Mitigate by creating runtime clients first
- **Data loss during schema changes** - Mitigate by backing up platform tables

### **Medium Risk**
- **API integration complexity** - Mitigate by thorough testing of runtime clients
- **Performance overhead** - Mitigate by optimizing API calls

### **Low Risk**
- **Documentation updates** - Update as part of migration
- **Test suite updates** - Update after migration complete

---

**This migration must be completed to enforce the runtime decision and eliminate architectural duplication.**
