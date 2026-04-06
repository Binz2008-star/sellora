import type { FulfillmentRepository } from "../../ports/fulfillment-repository.js";
import type {
  ShipmentBookingResult,
  ShippingGateway
} from "../../ports/shipping-gateway.js";
import type { TransitionOrderService } from "./transition-order.service.js";

export interface BookOrderShipmentInput {
  orderId: string;
  destinationCity?: string;
}

export interface BookOrderShipmentResult {
  booking: ShipmentBookingResult;
  transition: Awaited<ReturnType<TransitionOrderService["transition"]>>;
}

export class BookOrderShipmentService {
  constructor(
    private readonly fulfillmentRepository: FulfillmentRepository,
    private readonly shippingGateway: ShippingGateway,
    private readonly transitionOrderService: Pick<TransitionOrderService, "transition">
  ) {}

  async execute(input: BookOrderShipmentInput): Promise<BookOrderShipmentResult> {
    const context = await this.fulfillmentRepository.getShipmentContext(input.orderId);

    if (!context) {
      throw new Error(`Order not found: ${input.orderId}`);
    }

    if (context.order.status !== "packing") {
      throw new Error(`Order ${input.orderId} is not ready for shipment booking`);
    }

    if (context.lines.length === 0) {
      throw new Error(`Order ${input.orderId} has no shippable lines`);
    }

    const booking = await this.shippingGateway.bookShipment({
      orderId: context.order.id,
      destinationCity: input.destinationCity ?? context.destinationCity,
      items: context.lines.map((line) => ({
        title: line.titleSnapshot,
        quantity: line.quantity
      }))
    });

    const transition = await this.transitionOrderService.transition({
      orderId: context.order.id,
      nextStatus: "shipped",
      reason: "shipment_booked",
      fulfillment: {
        bookingReference: booking.bookingReference,
        courierName: booking.courierName,
        trackingNumber: booking.trackingNumber
      }
    });

    return {
      booking,
      transition
    };
  }
}
