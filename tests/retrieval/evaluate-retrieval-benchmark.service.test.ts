import { describe, expect, it } from "vitest";
import { LexicalRetrievalEngine } from "../../src/adapters/memory/lexical-retrieval-engine.js";
import { EvaluateRetrievalBenchmarkService } from "../../src/application/retrieval/evaluate-retrieval-benchmark.service.js";

describe("EvaluateRetrievalBenchmarkService", () => {
  it("computes recall and ndcg summaries for a retrieval benchmark dataset", async () => {
    const service = new EvaluateRetrievalBenchmarkService(new LexicalRetrievalEngine());

    const summary = await service.execute({
      dataset: {
        id: "support-search-smoke",
        name: "support-search-smoke",
        description: "Minimal support retrieval smoke test",
        useCases: ["support_search"],
        corpus: [
          {
            id: "doc_1",
            language: "en",
            title: "Refund payment issue",
            body: "Refunds for failed or duplicate payments"
          },
          {
            id: "doc_2",
            language: "en",
            title: "Shipment tracking help",
            body: "Track a shipped order"
          }
        ],
        cases: [
          {
            id: "case_refund",
            query: "refund payment",
            language: "en",
            useCase: "support_search",
            relevantDocumentIds: ["doc_1"]
          },
          {
            id: "case_tracking",
            query: "shipment tracking",
            language: "en",
            useCase: "support_search",
            relevantDocumentIds: ["doc_2"]
          }
        ]
      },
      topK: 5,
      failureRecallThreshold: 1
    });

    expect(summary.datasetName).toBe("support-search-smoke");
    expect(summary.caseCount).toBe(2);
    expect(summary.averageRecallAtK).toBe(1);
    expect(summary.averageNdcgAtK).toBe(1);
    expect(summary.failures).toHaveLength(0);
  });

  it("rejects datasets with case references that are not present in the corpus", async () => {
    const service = new EvaluateRetrievalBenchmarkService(new LexicalRetrievalEngine());

    await expect(
      service.execute({
        dataset: {
          id: "invalid-dataset",
          name: "invalid-dataset",
          description: "Invalid benchmark",
          useCases: ["support_search"],
          corpus: [
            {
              id: "doc_1",
              language: "en",
              body: "Refunds for failed or duplicate payments"
            }
          ],
          cases: [
            {
              id: "case_refund",
              query: "refund payment",
              language: "en",
              useCase: "support_search",
              relevantDocumentIds: ["missing_doc"]
            }
          ]
        },
        topK: 5
      })
    ).rejects.toThrow("references unknown relevant document ids");
  });
});
