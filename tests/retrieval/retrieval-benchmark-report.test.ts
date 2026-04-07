import { describe, expect, it } from "vitest";
import { LexicalRetrievalEngine } from "../../src/adapters/memory/lexical-retrieval-engine.js";
import { SELLORA_RETRIEVAL_SMOKE_DATASET } from "../../src/application/retrieval/retrieval-benchmark-catalog.js";
import { generateRetrievalBenchmarkReport } from "../../src/application/retrieval/retrieval-benchmark-report.js";

describe("generateRetrievalBenchmarkReport", () => {
  it("computes aggregate metrics and use-case breakdown", async () => {
    const report = await generateRetrievalBenchmarkReport({
      dataset: SELLORA_RETRIEVAL_SMOKE_DATASET,
      engine: new LexicalRetrievalEngine(),
      engineName: "lexical",
      topK: 3
    });

    expect(report.engineName).toBe("lexical");
    expect(report.caseCount).toBe(6);
    expect(report.recallAtK).toBeGreaterThanOrEqual(5 / 6);
    expect(report.mrr).toBeGreaterThan(0.8);
    expect(report.hitAtK).toBe(1);
    expect(report.breakdown).toEqual([
      expect.objectContaining({
        useCase: "catalog_candidate_retrieval",
        caseCount: 2
      }),
      expect.objectContaining({
        useCase: "help_center_grounding",
        caseCount: 2
      }),
      expect.objectContaining({
        useCase: "support_search",
        caseCount: 2
      })
    ]);
  });

  it("rejects invalid expected primary document references", async () => {
    await expect(
      generateRetrievalBenchmarkReport({
        dataset: {
          ...SELLORA_RETRIEVAL_SMOKE_DATASET,
          cases: [
            {
              ...SELLORA_RETRIEVAL_SMOKE_DATASET.cases[0],
              expectedPrimaryDocumentId: "missing_doc"
            }
          ]
        },
        engine: new LexicalRetrievalEngine(),
        engineName: "lexical",
        topK: 3
      })
    ).rejects.toThrow("expectedPrimaryDocumentId must also be listed as relevant");
  });
});
