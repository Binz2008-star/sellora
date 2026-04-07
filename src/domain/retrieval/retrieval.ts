export interface RetrievalDocument {
  id: string;
  language: string;
  title?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export type RetrievalBenchmarkUseCase =
  | "support_search"
  | "help_center_grounding"
  | "catalog_candidate_retrieval";

export interface RetrievalQuery {
  id?: string;
  text: string;
  language?: string;
  topK: number;
}

export interface RetrievalScoredDocument {
  documentId: string;
  score: number;
  rank: number;
}

export interface RetrievalSearchResult {
  query: RetrievalQuery;
  hits: RetrievalScoredDocument[];
}

export interface RetrievalBenchmarkCase {
  id: string;
  query: string;
  language: string;
  useCase: RetrievalBenchmarkUseCase;
  relevantDocumentIds: string[];
  expectedPrimaryDocumentId?: string;
  tags?: string[];
}

export interface RetrievalBenchmarkDataset {
  id: string;
  name: string;
  description: string;
  useCases: RetrievalBenchmarkUseCase[];
  cases: RetrievalBenchmarkCase[];
  corpus: RetrievalDocument[];
}

export interface RetrievalBenchmarkDatasetSummary {
  id: string;
  name: string;
  description: string;
  useCases: RetrievalBenchmarkUseCase[];
  caseCount: number;
  corpusDocumentCount: number;
}

export interface RetrievalBenchmarkCaseResult {
  caseId: string;
  recallAtK: number;
  ndcgAtK: number;
  returnedDocumentIds: string[];
  missingRelevantDocumentIds: string[];
}

export interface RetrievalBenchmarkSummary {
  datasetName: string;
  caseCount: number;
  topK: number;
  averageRecallAtK: number;
  averageNdcgAtK: number;
  failures: RetrievalBenchmarkCaseResult[];
}
