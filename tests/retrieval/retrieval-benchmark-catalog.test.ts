import { describe, expect, it } from "vitest";
import { LexicalRetrievalEngine } from "../../src/adapters/memory/lexical-retrieval-engine.js";
import { EvaluateRetrievalBenchmarkService } from "../../src/application/retrieval/evaluate-retrieval-benchmark.service.js";
import {
  BUILT_IN_RETRIEVAL_BENCHMARK_DATASETS,
  SELLORA_RETRIEVAL_SMOKE_DATASET,
  summarizeRetrievalBenchmarkDataset
} from "../../src/application/retrieval/retrieval-benchmark-catalog.js";
import { GetRetrievalBenchmarkDatasetService } from "../../src/application/retrieval/get-retrieval-benchmark-dataset.service.js";

describe("retrieval benchmark catalog", () => {
  it("keeps built-in dataset references internally consistent", () => {
    const corpusIds = new Set(SELLORA_RETRIEVAL_SMOKE_DATASET.corpus.map((document) => document.id));

    expect(BUILT_IN_RETRIEVAL_BENCHMARK_DATASETS).toHaveLength(1);
    expect(SELLORA_RETRIEVAL_SMOKE_DATASET.cases).not.toHaveLength(0);

    for (const benchmarkCase of SELLORA_RETRIEVAL_SMOKE_DATASET.cases) {
      expect(benchmarkCase.relevantDocumentIds).not.toHaveLength(0);
      for (const documentId of benchmarkCase.relevantDocumentIds) {
        expect(corpusIds.has(documentId)).toBe(true);
      }

      if (benchmarkCase.expectedPrimaryDocumentId) {
        expect(corpusIds.has(benchmarkCase.expectedPrimaryDocumentId)).toBe(true);
      }
    }
  });

  it("summarizes built-in datasets for admin discovery", () => {
    const summary = summarizeRetrievalBenchmarkDataset(SELLORA_RETRIEVAL_SMOKE_DATASET);

    expect(summary).toEqual({
      id: "sellora-retrieval-smoke-v1",
      name: "Sellora Retrieval Smoke v1",
      description: expect.stringContaining("Initial internal benchmark"),
      useCases: ["support_search", "help_center_grounding", "catalog_candidate_retrieval"],
      caseCount: 6,
      corpusDocumentCount: 6
    });
  });

  it("evaluates the built-in smoke dataset with the lexical baseline", async () => {
    const service = new EvaluateRetrievalBenchmarkService(new LexicalRetrievalEngine());

    const summary = await service.execute({
      dataset: SELLORA_RETRIEVAL_SMOKE_DATASET,
      topK: 3,
      failureRecallThreshold: 1
    });

    expect(summary.datasetName).toBe("Sellora Retrieval Smoke v1");
    expect(summary.caseCount).toBe(6);
    expect(summary.averageRecallAtK).toBeGreaterThanOrEqual(5 / 6);
    expect(summary.averageNdcgAtK).toBeGreaterThan(0.8);
    expect(summary.failures).toHaveLength(0);
  });

  it("retrieves built-in datasets by id", () => {
    const service = new GetRetrievalBenchmarkDatasetService();

    expect(service.list()).toHaveLength(1);
    expect(service.getOrThrow("sellora-retrieval-smoke-v1")).toBe(SELLORA_RETRIEVAL_SMOKE_DATASET);
    expect(() => service.getOrThrow("missing-dataset")).toThrow(
      "Retrieval benchmark not found: missing-dataset"
    );
  });
});
