import type { Quote, QuoteStatus } from "../../domain/quotes/quote.js";

const quoteTransitions: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent", "expired"],
  sent: ["approved", "rejected", "expired"],
  approved: ["converted", "expired"],
  rejected: [],
  expired: [],
  converted: []
};

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  return quoteTransitions[from].includes(to);
}

export class QuoteStateMachine {
  transition(quote: Quote, nextStatus: QuoteStatus): { quoteId: string; previousStatus: QuoteStatus; nextStatus: QuoteStatus } {
    if (!canTransitionQuote(quote.status, nextStatus)) {
      throw new Error(`Invalid quote transition: ${quote.status} -> ${nextStatus}`);
    }

    return {
      quoteId: quote.id,
      previousStatus: quote.status,
      nextStatus
    };
  }
}
