import {
  isTerminalPaymentStatus,
  type PaymentAttempt,
  type PaymentAttemptStatus
} from "../../domain/payments/payment.js";

export interface PaymentTransitionRequest {
  attempt: PaymentAttempt;
  nextStatus: PaymentAttemptStatus;
}

export interface PaymentTransitionResult {
  paymentAttemptId: string;
  previousStatus: PaymentAttemptStatus;
  nextStatus: PaymentAttemptStatus;
}

const PAYMENT_TRANSITIONS: Record<PaymentAttemptStatus, PaymentAttemptStatus[]> = {
  pending: ["processing", "paid", "failed"],
  processing: ["paid", "failed"],
  paid: ["refunded"],
  failed: [],
  refunded: []
};

export class PaymentStateMachine {
  canTransition(from: PaymentAttemptStatus, to: PaymentAttemptStatus): boolean {
    return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
  }

  transition(request: PaymentTransitionRequest): PaymentTransitionResult {
    const { attempt, nextStatus } = request;

    if (!this.canTransition(attempt.status, nextStatus)) {
      throw new Error(`Invalid payment transition: ${attempt.status} -> ${nextStatus}`);
    }

    return {
      paymentAttemptId: attempt.id,
      previousStatus: attempt.status,
      nextStatus
    };
  }

  isTerminal(status: PaymentAttemptStatus): boolean {
    return isTerminalPaymentStatus(status);
  }
}
