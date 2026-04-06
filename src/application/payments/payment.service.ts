import type { TransitionOrderService } from "../orders/transition-order.service.js";
import type { PaymentRepository } from "../../ports/payment-repository.js";
import type { KeyValueRecord } from "../../domain/shared/types.js";
import type { PaymentAttemptContext } from "../../ports/payment-repository.js";
import type { PaymentAttempt } from "../../domain/payments/payment.js";
import { PaymentStateMachine } from "../../modules/payments/payment-state-machine.js";
import type { EventBus } from "../../ports/event-bus.js";
import { createIdempotencyKey } from "../../modules/events/idempotency.js";
import type { EventEnvelope } from "../../domain/events/event-envelope.js";

export interface InitiatePaymentAttemptInput {
  sellerId: string;
  orderId: string;
  provider: string;
  amountMinor: number;
  currency: string;
  idempotencyKey?: string;
  metadata?: KeyValueRecord;
  rawPayload?: KeyValueRecord;
}

export interface MarkPaymentProcessingInput {
  paymentAttemptId: string;
  metadata?: KeyValueRecord;
  rawPayload?: KeyValueRecord;
}

export interface MarkPaymentSucceededInput {
  paymentAttemptId: string;
  provider: string;
  providerReference: string;
  metadata?: KeyValueRecord;
  rawPayload?: KeyValueRecord;
}

export interface MarkPaymentFailedInput {
  paymentAttemptId: string;
  reason?: string;
  metadata?: KeyValueRecord;
  rawPayload?: KeyValueRecord;
}

function canAdvanceOrderAfterPayment(orderStatus: PaymentAttemptContext["order"]["status"]): boolean {
  return orderStatus === "pending_payment" || orderStatus === "reserved";
}

function isAdvancedOrderState(orderStatus: PaymentAttemptContext["order"]["status"]): boolean {
  return ["confirmed", "packing", "shipped", "delivered"].includes(orderStatus);
}

export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly transitionOrderService: Pick<TransitionOrderService, "transition">,
    private readonly paymentStateMachine = new PaymentStateMachine(),
    private readonly eventBus?: EventBus
  ) {}

  async initiatePaymentAttempt(input: InitiatePaymentAttemptInput): Promise<PaymentAttemptContext> {
    if (input.idempotencyKey) {
      const existingByKey = await this.paymentRepository.findAttemptContextByIdempotencyKey(
        input.sellerId,
        input.idempotencyKey
      );

      if (existingByKey) {
        return existingByKey;
      }
    }

    const activeAttempt = await this.paymentRepository.findActiveAttemptForOrder(input.orderId);
    if (activeAttempt) {
      throw new Error(`Active payment attempt already exists for order ${input.orderId}`);
    }

    return this.paymentRepository.createAttempt(input);
  }

  async markProcessing(input: MarkPaymentProcessingInput): Promise<PaymentAttemptContext> {
    const context = await this.paymentRepository.findAttemptContextById(input.paymentAttemptId);
    if (!context) {
      throw new Error(`Payment attempt not found: ${input.paymentAttemptId}`);
    }

    if (context.attempt.status === "processing") {
      return context;
    }

    this.paymentStateMachine.transition({
      attempt: context.attempt,
      nextStatus: "processing"
    });

    return this.paymentRepository.updateAttemptStatus({
      paymentAttemptId: context.attempt.id,
      expectedCurrentStatus: context.attempt.status,
      nextStatus: "processing",
      metadata: input.metadata,
      rawPayload: input.rawPayload,
      eventType: "payment_processing"
    });
  }

  async markSucceeded(input: MarkPaymentSucceededInput): Promise<PaymentAttemptContext> {
    const transactionResult = await this.paymentRepository.withTransaction(async (transaction) => {
      const duplicateByReference = await this.paymentRepository.findAttemptContextByProviderReference(
        input.provider,
        input.providerReference,
        transaction
      );

      if (duplicateByReference) {
        if (
          duplicateByReference.attempt.id === input.paymentAttemptId &&
          duplicateByReference.attempt.status === "paid"
        ) {
        return {
          context: duplicateByReference,
          pendingExternalEvents: []
        };
        }

        throw new Error(`Duplicate provider reference detected: ${input.providerReference}`);
      }

      const context = await this.paymentRepository.findAttemptContextById(
        input.paymentAttemptId,
        transaction
      );
      if (!context) {
        throw new Error(`Payment attempt not found: ${input.paymentAttemptId}`);
      }

      if (context.attempt.provider !== input.provider) {
        throw new Error(`Provider mismatch for payment attempt ${input.paymentAttemptId}`);
      }

      if (
        context.attempt.status === "paid" &&
        context.attempt.providerReference === input.providerReference
      ) {
        return {
          context,
          pendingExternalEvents: []
        };
      }

      this.paymentStateMachine.transition({
        attempt: context.attempt,
        nextStatus: "paid"
      });

      const updated = await this.paymentRepository.updateAttemptStatus(
        {
          paymentAttemptId: context.attempt.id,
          expectedCurrentStatus: context.attempt.status,
          nextStatus: "paid",
          providerReference: input.providerReference,
          metadata: input.metadata,
          rawPayload: input.rawPayload,
          eventType: "payment_succeeded"
        },
        transaction
      );

      const pendingExternalEvents: EventEnvelope[] = [{
        id: createIdempotencyKey(["payment_succeeded", updated.attempt.id, input.providerReference]),
        aggregateType: "payment_attempt",
        aggregateId: updated.attempt.id,
        eventType: "payment_succeeded",
        occurredAt: updated.attempt.updatedAt,
        idempotencyKey: createIdempotencyKey([
          "payment_succeeded",
          updated.attempt.id,
          input.providerReference
        ]),
        payload: {
          sellerId: updated.attempt.sellerId,
          orderId: updated.attempt.orderId,
          provider: updated.attempt.provider,
          providerReference: input.providerReference,
          amountMinor: updated.attempt.amount.amountMinor,
          currency: updated.attempt.amount.currency,
          status: updated.attempt.status
        }
      }];

      if (canAdvanceOrderAfterPayment(updated.order.status)) {
        const transition = await this.transitionOrderService.transition(
          {
            orderId: updated.order.id,
            nextStatus: "confirmed",
            reason: "payment_succeeded"
          },
          {
            transaction,
            publishExternalEvents: false
          }
        );

        return {
          context: updated,
          pendingExternalEvents: [...pendingExternalEvents, ...transition.pendingExternalEvents]
        };
      }

      if (!isAdvancedOrderState(updated.order.status)) {
        return {
          context: updated,
          pendingExternalEvents
        };
      }

      return {
        context: updated,
        pendingExternalEvents
      };
    });

    if (this.eventBus) {
      for (const event of transactionResult.pendingExternalEvents) {
        await this.eventBus.publish(event);
      }
    }

    return transactionResult.context;
  }

  async markFailed(input: MarkPaymentFailedInput): Promise<PaymentAttemptContext> {
    const context = await this.paymentRepository.findAttemptContextById(input.paymentAttemptId);
    if (!context) {
      throw new Error(`Payment attempt not found: ${input.paymentAttemptId}`);
    }

    if (context.attempt.status === "failed") {
      return context;
    }

    this.paymentStateMachine.transition({
      attempt: context.attempt,
      nextStatus: "failed"
    });

    const metadata: KeyValueRecord = {
      ...(input.metadata ?? {}),
      failureReason: input.reason ?? null
    };

    const updated = await this.paymentRepository.updateAttemptStatus({
      paymentAttemptId: context.attempt.id,
      expectedCurrentStatus: context.attempt.status,
      nextStatus: "failed",
      metadata,
      rawPayload: input.rawPayload,
      eventType: "payment_failed"
    });

    if (this.eventBus) {
      const providerReference = updated.attempt.providerReference ?? "none";
      await this.eventBus.publish({
        id: createIdempotencyKey(["payment_failed", updated.attempt.id, providerReference]),
        aggregateType: "payment_attempt",
        aggregateId: updated.attempt.id,
        eventType: "payment_failed",
        occurredAt: updated.attempt.updatedAt,
        idempotencyKey: createIdempotencyKey([
          "payment_failed",
          updated.attempt.id,
          providerReference
        ]),
        payload: {
          sellerId: updated.attempt.sellerId,
          orderId: updated.attempt.orderId,
          provider: updated.attempt.provider,
          providerReference: updated.attempt.providerReference ?? null,
          amountMinor: updated.attempt.amount.amountMinor,
          currency: updated.attempt.amount.currency,
          status: updated.attempt.status,
          failureReason: input.reason ?? null
        }
      });
    }

    return updated;
  }
}
