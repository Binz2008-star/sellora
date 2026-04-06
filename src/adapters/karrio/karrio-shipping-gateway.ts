import type {
  ShipmentBookingRequest,
  ShipmentBookingResult,
  ShippingGateway
} from "../../ports/shipping-gateway.js";

export interface KarrioShippingGatewayOptions {
  baseUrl: string;
}

export class KarrioShippingGateway implements ShippingGateway {
  constructor(private readonly options: KarrioShippingGatewayOptions) {}

  async bookShipment(request: ShipmentBookingRequest): Promise<ShipmentBookingResult> {
    void request;
    void this.options;
    throw new Error("KarrioShippingGateway is not wired yet");
  }
}
