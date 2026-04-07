import type {
  RetrievalBenchmarkDataset,
  RetrievalBenchmarkCaseResult,
  RetrievalBenchmarkSummary
} from "../../domain/retrieval/retrieval.js";
import type { RetrievalEngine } from "../../ports/retrieval-engine.js";

export interface EvaluateRetrievalBenchmarkRequest {
  dataset: RetrievalBenchmarkDataset;
  topK: number;
  failureRecallThreshold?: number;
}

function dcgAtK(returnedIds: string[], relevantIds: Set<string>): number {
  return returnedIds.reduce((sum, documentId, index) => {
    if (!relevantIds.has(documentId)) {
      return sum;
    }

    return sum + 1 / Math.log2(index + 2);
  }, 0);
}

function idealDcgAtK(relevantCount: number, k: number): number {
  return Array.from({ length: Math.min(relevantCount, k) }).reduce<number>((sum, _, index) => {
    return sum + 1 / Math.log2(index + 2);
  }, 0);
}

export class EvaluateRetrievalBenchmarkService {
  constructor(private readonly retrievalEngine: RetrievalEngine) {}

  async execute(input: EvaluateRetrievalBenchmarkRequest): Promise<RetrievalBenchmarkSummary> {
    const results: RetrievalBenchmarkCaseResult[] = [];

    for (const benchmarkCase of input.dataset.cases) {
      const response = await this.retrievalEngine.search({
        query: {
          id: benchmarkCase.id,
          text: benchmarkCase.query,
          language: benchmarkCase.language,
          topK: input.topK
        },
        corpus: input.dataset.corpus
      });

      const returnedIds = response.hits.map((hit) => hit.documentId);
      const relevantIds = new Set(benchmarkCase.relevantDocumentIds);
      const hitCount = returnedIds.filter((documentId) => relevantIds.has(documentId)).length;
      const recallAtK =
        benchmarkCase.relevantDocumentIds.length === 0
          ? 1
          : hitCount / benchmarkCase.relevantDocumentIds.length;
      const ideal = idealDcgAtK(benchmarkCase.relevantDocumentIds.length, input.topK);
      const ndcgAtK = ideal === 0 ? 1 : dcgAtK(returnedIds, relevantIds) / ideal;

      results.push({
        caseId: benchmarkCase.id,
        recallAtK,
        ndcgAtK,
        returnedDocumentIds: returnedIds,
        missingRelevantDocumentIds: benchmarkCase.relevantDocumentIds.filter(
          (documentId) => !returnedIds.includes(documentId)
        )
      });
    }

    const averageRecallAtK =
      results.reduce((sum, result) => sum + result.recallAtK, 0) / Math.max(results.length, 1);
    const averageNdcgAtK =
      results.reduce((sum, result) => sum + result.ndcgAtK, 0) / Math.max(results.length, 1);
    const failureThreshold = input.failureRecallThreshold ?? 1;

    return {
      datasetName: input.dataset.name,
      caseCount: results.length,
      topK: input.topK,
      averageRecallAtK,
      averageNdcgAtK,
      failures: results.filter((result) => result.recallAtK < failureThreshold)
    };
  }
}
