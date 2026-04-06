export interface ShipmentBookingRequest {
  orderId: string;
  destinationCity?: string;
  items: Array<{
    title: string;
    quantity: number;
  }>;
}

export interface ShipmentBookingResult {
  bookingReference: string;
  trackingNumber?: string;
  courierName?: string;
}

export interface ShippingGateway {
  bookShipment(request: ShipmentBookingRequest): Promise<ShipmentBookingResult>;
}
