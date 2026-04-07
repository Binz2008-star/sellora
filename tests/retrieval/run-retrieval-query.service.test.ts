import { describe, expect, it } from "vitest";
import { LexicalRetrievalEngine } from "../../src/adapters/memory/lexical-retrieval-engine.js";
import { RunRetrievalQueryService } from "../../src/application/retrieval/run-retrieval-query.service.js";

describe("RunRetrievalQueryService", () => {
  it("returns lexical top-k hits for mixed-language support search", async () => {
    const service = new RunRetrievalQueryService(new LexicalRetrievalEngine());

    const result = await service.execute({
      query: "refund payment",
      language: "en",
      topK: 2,
      corpus: [
        {
          id: "doc_payment_refund",
          language: "en",
          title: "Payment refund policy",
          body: "Refund failed or pending payment issues"
        },
        {
          id: "doc_shipping",
          language: "en",
          title: "Shipping tracking",
          body: "Track shipment and delivery updates"
        },
        {
          id: "doc_arabic",
          language: "ar",
          title: "استرجاع المدفوعات",
          body: "سياسة الاسترجاع والمدفوعات"
        }
      ]
    });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.documentId).toBe("doc_payment_refund");
    expect(result.hits[0]?.rank).toBe(1);
  });
});
