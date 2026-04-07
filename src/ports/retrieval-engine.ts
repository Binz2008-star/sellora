import type {
  RetrievalBenchmarkDataset,
  RetrievalDocument,
  RetrievalQuery,
  RetrievalSearchResult
} from "../domain/retrieval/retrieval.js";

export interface RetrievalSearchInput {
  query: RetrievalQuery;
  corpus: RetrievalDocument[];
}

export interface RetrievalEngine {
  search(input: RetrievalSearchInput): Promise<RetrievalSearchResult>;
}

export interface RetrievalBenchmarkInput {
  dataset: RetrievalBenchmarkDataset;
  topK: number;
}
