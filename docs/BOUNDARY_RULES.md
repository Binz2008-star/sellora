# Boundary Rules - Platform Intelligence

## **Effective: 2026-04-08**

---

## **Domain Ownership**

### **Sellora Owns (Authoritative)**
- Catalog Management (products, categories, templates)
- AI Sourcing (supplier import, enrichment, normalization)
- Opportunity Engine (profit discovery, scoring, recommendations)
- Autonomous Workflows (policy-governed automation, decision engines)
- Platform Integration (external services, third-party APIs)
- Localization (Arabic/English support)
- WhatsApp Integration (messaging, conversational commerce)
- Multi-tenant Management (seller onboarding, platform policies)

### **Sellora Consumes (via APIs)**
- Order status from runtime
- Payment status from runtime
- Inventory availability from runtime
- User information from runtime

### **Sellora Forbidden (Runtime Domain)**
- Order creation logic
- Order state transitions
- Payment processing logic
- Authentication implementation
- Inventory mutations
- Audit event creation

---

## **Data Ownership Rules**

### **Platform Database (Allowed)**
```sql
-- Catalog tables
products
categories
catalog_templates

-- AI/ML tables
enrichment_data
opportunity_scores
sourcing_imports

-- Workflow tables
autonomy_policies
workflow_runs
integration_configs

-- Localization tables
translations
cultural_adaptations
```

### **Runtime Database (Forbidden)**
```sql
-- These tables CANNOT exist in sellora
orders
payments
payment_attempts
users
sessions
inventory
audit_events
```

---

## **API Boundaries**

### **Platform APIs (Can Expose)**
```typescript
// Catalog APIs
GET /api/catalog/products
POST /api/catalog/products
PUT /api/catalog/products/{id}

// Sourcing APIs  
POST /api/sourcing/import
GET /api/sourcing/opportunities

// Workflow APIs
GET /api/workflows/active
POST /api/workflows/execute
```

### **Runtime APIs (Cannot Expose)**
```typescript
// These endpoints CANNOT exist in sellora
POST /api/orders
PATCH /api/orders/{id}/status
POST /api/payments
POST /api/inventory/reserve
POST /api/auth/login
```

### **Runtime Client Usage**
```typescript
// CORRECT: Use runtime client
import { runtimeClient } from '../integration/runtime-client'

const order = await runtimeClient.getOrder(orderId)
const inventory = await runtimeClient.getInventory(productId)

// FORBIDDEN: Direct runtime access
fetch('/api/orders') // WRONG
prisma.order.find()  // WRONG
```

---

## **Code Patterns**

### **Allowed Patterns**
```typescript
// Catalog management - PLATFORM DOMAIN
class CatalogService {
  async createProduct(data: CreateProductData) {
    // Platform database only
    return await this.platformDb.product.create({ data })
  }
  
  async enrichProduct(productId: string) {
    // AI enrichment logic
    const enrichment = await this.aiService.enrich(productId)
    return await this.platformDb.product.update({
      where: { id: productId },
      data: { enrichment }
    })
  }
}

// Runtime consumption - SAFE QUERIES ONLY
class OrderStatusService {
  async getOrderStatus(orderId: string) {
    // Query runtime via client
    return await this.runtimeClient.getOrder(orderId)
  }
}
```

### **Forbidden Patterns**
```typescript
// FORBIDDEN: Runtime logic in platform
class OrderService {
  async createOrder(data: CreateOrderData) {
    // VIOLATION: Order creation belongs to runtime
    return await this.db.order.create({ data })
  }
  
  async transitionOrder(orderId: string, status: OrderStatus) {
    // VIOLATION: State transitions belong to runtime
    return await this.db.order.update({
      where: { id: orderId },
      data: { status }
    })
  }
}

// FORBIDDEN: Direct runtime database access
class InventoryService {
  async reserveStock(productId: string, quantity: number) {
    // VIOLATION: Inventory mutations belong to runtime
    return await this.runtimeDb.inventory.update({
      where: { productId },
      data: { reserved: { increment: quantity } }
    })
  }
}
```

---

## **Integration Rules**

### **Runtime Client Integration**
```typescript
// src/integration/runtime-client/index.ts
export class RuntimeClient {
  private baseUrl: string
  private authToken: string
  
  constructor(config: RuntimeConfig) {
    this.baseUrl = config.runtimeUrl
    this.authToken = config.authToken
  }
  
  // Query APIs only
  async getOrder(orderId: string): Promise<Order> {
    return await this.fetch(`/api/orders/${orderId}`)
  }
  
  async getPayment(paymentId: string): Promise<Payment> {
    return await this.fetch(`/api/payments/${paymentId}`)
  }
  
  async getInventory(productId: string): Promise<Inventory> {
    return await this.fetch(`/api/inventory/${productId}`)
  }
  
  private async fetch(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      }
    })
    return response.json()
  }
}
```

### **Service Integration Pattern**
```typescript
// src/services/catalog-service.ts
export class CatalogService {
  constructor(
    private platformDb: PrismaClient,
    private runtimeClient: RuntimeClient
  ) {}
  
  async getProductWithAvailability(productId: string) {
    // Platform data
    const product = await this.platformDb.product.findUnique({
      where: { id: productId }
    })
    
    // Runtime data via API
    const inventory = await this.runtimeClient.getInventory(productId)
    
    return {
      ...product,
      available: inventory.available
    }
  }
}
```

---

## **CI Enforcement**

The boundary checks CI workflow enforces:

1. **No runtime logic patterns** in platform code
2. **No runtime database access** from platform
3. **Proper runtime client usage** for all runtime access
4. **Catalog ownership verification**
5. **API endpoint classification** (no commands in platform)

---

## **Violation Response**

If boundary violations are detected:

1. **Stop** the work immediately
2. **Identify** the ownership violation
3. **Refactor** to use proper patterns
4. **Update** integration to use runtime client
5. **Move** logic to correct domain

---

## **These rules prevent architectural drift and maintain clean domain boundaries.**
