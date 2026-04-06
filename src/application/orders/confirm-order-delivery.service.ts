import type {
  FulfillmentDeliveryContext,
  FulfillmentRepository
} from "../../ports/fulfillment-repository.js";
import type { TransitionOrderService } from "./transition-order.service.js";

export interface ConfirmOrderDeliveryInput {
  orderId: string;
}

export interface ConfirmOrderDeliveryResult {
  context: FulfillmentDeliveryContext;
  transition?: Awaited<ReturnType<TransitionOrderService["transition"]>>;
  duplicateConfirmation: boolean;
}

export class ConfirmOrderDeliveryService {
  constructor(
    private readonly fulfillmentRepository: FulfillmentRepository,
    private readonly transitionOrderService: Pick<TransitionOrderService, "transition">
  ) {}

  async execute(input: ConfirmOrderDeliveryInput): Promise<ConfirmOrderDeliveryResult> {
    const context = await this.fulfillmentRepository.getDeliveryContext(input.orderId);

    if (!context) {
      throw new Error(`Order not found: ${input.orderId}`);
    }

    if (context.order.status === "delivered") {
      return {
        context,
        duplicateConfirmation: true
      };
    }

    if (context.order.status !== "shipped") {
      throw new Error(`Order ${input.orderId} is not eligible for delivery confirmation`);
    }

    const transition = await this.transitionOrderService.transition({
      orderId: context.order.id,
      nextStatus: "delivered",
      reason: "delivery_confirmed"
    });

    return {
      context,
      transition,
      duplicateConfirmation: false
    };
  }
}
