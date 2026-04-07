import type {
  RetrievalBenchmarkDataset,
  RetrievalBenchmarkDatasetSummary
} from "../../domain/retrieval/retrieval.js";
import {
  BUILT_IN_RETRIEVAL_BENCHMARK_DATASETS,
  summarizeRetrievalBenchmarkDataset
} from "./retrieval-benchmark-catalog.js";

export class GetRetrievalBenchmarkDatasetService {
  constructor(
    private readonly datasets: RetrievalBenchmarkDataset[] = BUILT_IN_RETRIEVAL_BENCHMARK_DATASETS
  ) {}

  list(): RetrievalBenchmarkDatasetSummary[] {
    return this.datasets.map((dataset) => summarizeRetrievalBenchmarkDataset(dataset));
  }

  getOrThrow(datasetId: string): RetrievalBenchmarkDataset {
    const dataset = this.datasets.find((candidate) => candidate.id === datasetId);
    if (!dataset) {
      throw new Error(`Retrieval benchmark not found: ${datasetId}`);
    }

    return dataset;
  }
}
