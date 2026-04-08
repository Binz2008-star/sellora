# STOP OVERLAP WORK - IMMEDIATE EFFECTIVE

## **BANNED WORK IN SELLORA**

**Effective: 2026-04-08**

The following work is **FORBIDDEN** in `sellora` due to runtime ownership by `order-management-backend`:

---

### **ORDER LIFECYCLE - BANNED**
- Order creation logic
- Order state transitions
- Order status mutations
- Order cancellation logic
- Order fulfillment logic

### **PAYMENT PROCESSING - BANNED**
- Payment attempt creation
- Payment state changes
- Payment webhook handling
- Payment reconciliation
- Refund processing
- Chargeback handling

### **AUTHENTICATION RUNTIME - BANNED**
- JWT token generation
- User authentication logic
- Password verification
- Session management
- User registration

### **AUDIT EVENTS - BANNED**
- Order event creation
- Payment event creation
- Audit trail writing
- Event logging logic

### **INVENTORY MUTATIONS - BANNED**
- Stock reservation logic
- Stock deduction logic
- Stock release logic
- Inventory state changes

---

## **ALLOWED WORK IN SELLORA**

### **CATALOG MANAGEMENT**
- Product definitions
- Category management
- Template systems
- Product metadata

### **AI SOURCING**
- Supplier product import
- Product enrichment
- Data normalization
- Source discovery

### **PLATFORM WORKFLOWS**
- Orchestration logic
- Policy engines
- Automation rules
- Integration workflows

### **EXTERNAL INTEGRATION**
- Third-party API clients
- WhatsApp integration
- External service adapters

### **LOCALIZATION**
- Arabic/English support
- Translation logic
- Cultural adaptation

---

## **REQUIRED ACTION**

### **For Existing Overlap Code**
1. **STOP** all development immediately
2. **IDENTIFY** files that violate these rules
3. **MARK** them for migration or deletion
4. **DO NOT** commit any overlap code

### **For New Development**
1. **CHECK** if work touches banned domains
2. **USE** runtime APIs instead of implementing logic
3. **FOLLOW** API consumption patterns
4. **VALIDATE** ownership before coding

---

## **VIOLATION CONSEQUENCES**

Any code violating these rules will be:
1. **Rejected** in code review
2. **Deleted** if committed
3. **Refactored** to use runtime APIs
4. **Blocked** from deployment

---

## **API CONSUMPTION PATTERN**

Instead of implementing banned logic, use runtime APIs:

```typescript
// WRONG - Order creation logic in sellora
const order = await createOrderLogic(data) // BANNED

// RIGHT - Consume runtime API
const order = await runtimeClient.createOrder(data) // ALLOWED
```

---

**This ban is IMMEDIATE and BINDING.**
