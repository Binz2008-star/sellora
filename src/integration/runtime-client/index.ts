/**
 * Runtime API Client
 *
 * Provides safe query-only access to runtime APIs.
 * All runtime access must go through this client.
 */

export interface RuntimeConfig {
  runtimeUrl: string
  authToken: string
  timeout?: number
}

export interface Order {
  id: string
  status: string
  sellerId: string
  customerId: string
  orderNumber: string
  mode: string
  paymentPolicy: string
  paymentStatus: string
  subtotalMinor: number
  deliveryFeeMinor: number
  totalMinor: number
  currency: string
  reservationExpiresAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
  customer?: {
    city: string | null
  }
  lines?: Array<{
    productOfferingId: string
    titleSnapshot: string
    quantity: number
  }>
}

export interface Payment {
  id: string
  orderId: string
  status: string
  amount: number
  provider: string
  createdAt: string
  updatedAt: string
}

export interface Inventory {
  productId: string
  available: number
  reserved: number
  total: number
}

export interface User {
  id: string
  email: string
  name: string
  sellerId?: string
}

export class RuntimeClient {
  private baseUrl: string
  private authToken: string
  private timeout: number

  constructor(config: RuntimeConfig) {
    this.baseUrl = config.runtimeUrl.replace(/\/$/, '')
    this.authToken = config.authToken
    this.timeout = config.timeout || 10000
  }

  // Query APIs only - no mutations
  async getOrder(orderId: string): Promise<Order> {
    return this.fetch(`/api/orders/${orderId}`)
  }

  async getOrdersBySeller(sellerId: string, options?: {
    status?: string
    page?: number
    limit?: number
  }): Promise<{ orders: Order[], total: number }> {
    const params = new URLSearchParams()
    if (options?.status) params.append('status', options.status)
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())

    return this.fetch(`/api/sellers/${sellerId}/orders?${params}`)
  }

  async getOrderEvents(orderId: string): Promise<any[]> {
    return this.fetch(`/api/orders/${orderId}/events`)
  }

  async getPayment(paymentId: string): Promise<Payment> {
    return this.fetch(`/api/payments/${paymentId}`)
  }

  async getPaymentEvents(paymentId: string): Promise<any[]> {
    return this.fetch(`/api/payments/${paymentId}/events`)
  }

  async getInventory(productId: string): Promise<Inventory> {
    return this.fetch(`/api/inventory/${productId}`)
  }

  async getSellerInventory(sellerId: string, options?: {
    page?: number
    limit?: number
  }): Promise<{ inventory: any[], total: number }> {
    const params = new URLSearchParams()
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())

    return this.fetch(`/api/sellers/${sellerId}/inventory?${params}`)
  }

  async getCurrentUser(): Promise<User> {
    return this.fetch('/api/me')
  }

  async getSeller(sellerId: string): Promise<any> {
    return this.fetch(`/api/sellers/${sellerId}`)
  }

  private async fetch(endpoint: string): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new RuntimeApiError(
          `Runtime API error: ${response.status} ${response.statusText}`,
          response.status,
          endpoint
        )
      }

      return await response.json()
    } catch (error: unknown) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new RuntimeApiError(
          'Runtime API request timeout',
          408,
          endpoint
        )
      }

      throw error
    }
  }
}

export class RuntimeApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string
  ) {
    super(message)
    this.name = 'RuntimeApiError'
  }
}

// Singleton instance for application-wide use
let runtimeClient: RuntimeClient | null = null

export function initializeRuntimeClient(config: RuntimeConfig): RuntimeClient {
  runtimeClient = new RuntimeClient(config)
  return runtimeClient
}

export function getRuntimeClient(): RuntimeClient {
  if (!runtimeClient) {
    throw new Error('Runtime client not initialized. Call initializeRuntimeClient first.')
  }
  return runtimeClient
}
