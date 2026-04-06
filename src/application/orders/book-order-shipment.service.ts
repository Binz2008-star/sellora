import type { FulfillmentRepository } from "../../ports/fulfillment-repository.js";
import type {
  ShipmentBookingResult,
  ShippingGateway
} from "../../ports/shipping-gateway.js";
import type { TransitionOrderService } from "./transition-order.service.js";
import { logOperationalEvent } from "../../core/logging.js";

export interface BookOrderShipmentInput {
  orderId: string;
  destinationCity?: string;
}

export interface BookOrderShipmentResult {
  booking: ShipmentBookingResult;
  transition?: Awaited<ReturnType<TransitionOrderService["transition"]>>;
  duplicateBooking: boolean;
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

    if (context.order.status === "shipped" && context.fulfillmentRecord?.bookingReference) {
      logOperationalEvent("info", "shipment_booking_duplicate", {
        orderId: context.order.id,
        bookingReference: context.fulfillmentRecord.bookingReference
      });
      return {
        booking: {
          success: true,
          provider: context.fulfillmentRecord.courierName ?? "unknown",
          providerReference: context.fulfillmentRecord.bookingReference,
          bookingReference: context.fulfillmentRecord.bookingReference,
          trackingNumber: context.fulfillmentRecord.trackingNumber,
          trackingUrl: context.fulfillmentRecord.trackingUrl,
          courierName: context.fulfillmentRecord.courierName,
          rawPayload: context.fulfillmentRecord.rawPayload
        },
        duplicateBooking: true
      };
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

    if (!booking.success || !booking.providerReference) {
      logOperationalEvent("error", "shipment_booking_failed", {
        orderId: context.order.id,
        provider: booking.provider,
        failureCode: booking.failureCode ?? null,
        failureMessage: booking.failureMessage ?? "Shipment booking failed"
      });
      throw new Error(booking.failureMessage ?? "Shipment booking failed");
    }

    const transition = await this.transitionOrderService.transition({
      orderId: context.order.id,
      nextStatus: "shipped",
      reason: "shipment_booked",
      fulfillment: {
        bookingReference: booking.providerReference,
        courierName: booking.courierName,
        trackingNumber: booking.trackingNumber,
        trackingUrl: booking.trackingUrl,
        rawPayload: booking.rawPayload
      }
    });

    logOperationalEvent("info", "shipment_booked", {
      orderId: context.order.id,
      provider: booking.provider,
      bookingReference: booking.providerReference,
      trackingNumber: booking.trackingNumber ?? null
    });

    return {
      booking,
      transition,
      duplicateBooking: false
    };
  }
}
