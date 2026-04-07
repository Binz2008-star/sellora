import { describe, expect, it } from "vitest";
import benchmarkFixture from "../../src/fixtures/retrieval/benchmark.v1.json" with { type: "json" };

describe("benchmark.v1 fixture", () => {
  it("contains distractors and harder retrieval cases", () => {
    expect(benchmarkFixture.id).toBe("sellora-retrieval-benchmark-v1.1");
    expect(benchmarkFixture.name).toBe("Sellora Retrieval Benchmark v1.1");
    expect(benchmarkFixture.corpus.length).toBe(14);
    expect(benchmarkFixture.cases.length).toBe(8);
    expect(
      benchmarkFixture.corpus.some((document) => document.id === "catalog_iphone_15_blue_ar")
    ).toBe(true);
    expect(
      benchmarkFixture.cases.some((benchmarkCase) => benchmarkCase.id === "case_catalog_iphone_ar_storage")
    ).toBe(true);
    expect(
      benchmarkFixture.cases.some((benchmarkCase) => benchmarkCase.id === "case_catalog_buds_white_en")
    ).toBe(true);
  });
});
