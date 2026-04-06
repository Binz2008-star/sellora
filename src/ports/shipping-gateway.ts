import type { KeyValueRecord } from "../domain/shared/types.js";

export interface ShipmentBookingRequest {
  orderId: string;
  destinationCity?: string;
  items: Array<{
    title: string;
    quantity: number;
  }>;
}

export interface ShipmentBookingResult {
  success: boolean;
  provider: string;
  providerReference?: string;
  bookingReference?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  courierName?: string;
  rawPayload?: KeyValueRecord;
  failureCode?: string;
  failureMessage?: string;
}

export interface ShippingGateway {
  bookShipment(request: ShipmentBookingRequest): Promise<ShipmentBookingResult>;
}
