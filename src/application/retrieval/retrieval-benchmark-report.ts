import type {
  RetrievalBenchmarkDataset,
  RetrievalBenchmarkUseCase
} from "../../domain/retrieval/retrieval.js";
import type { RetrievalEngine } from "../../ports/retrieval-engine.js";
import { validateRetrievalBenchmarkDataset } from "./retrieval-benchmark-dataset-validation.js";

export interface RetrievalBenchmarkUseCaseReport {
  useCase: RetrievalBenchmarkUseCase;
  caseCount: number;
  recallAtK: number;
  mrr: number;
  hitAtK: number;
}

export interface RetrievalBenchmarkReport {
  datasetId: string;
  datasetName: string;
  engineName: string;
  topK: number;
  caseCount: number;
  recallAtK: number;
  mrr: number;
  hitAtK: number;
  breakdown: RetrievalBenchmarkUseCaseReport[];
}

interface Aggregate {
  recallAtK: number;
  reciprocalRank: number;
  hitAtK: number;
}

function reciprocalRank(returnedIds: string[], relevantIds: Set<string>): number {
  const firstRelevantIndex = returnedIds.findIndex((documentId) => relevantIds.has(documentId));
  return firstRelevantIndex === -1 ? 0 : 1 / (firstRelevantIndex + 1);
}

function hitAtK(returnedIds: string[], relevantIds: Set<string>): number {
  return returnedIds.some((documentId) => relevantIds.has(documentId)) ? 1 : 0;
}

function recallAtK(returnedIds: string[], relevantIds: string[]): number {
  if (relevantIds.length === 0) {
    return 1;
  }

  const relevantSet = new Set(relevantIds);
  const hitCount = returnedIds.filter((documentId) => relevantSet.has(documentId)).length;
  return hitCount / relevantIds.length;
}

function average(total: number, count: number): number {
  return count === 0 ? 0 : total / count;
}

export async function generateRetrievalBenchmarkReport(input: {
  dataset: RetrievalBenchmarkDataset;
  engine: RetrievalEngine;
  engineName: string;
  topK: number;
}): Promise<RetrievalBenchmarkReport> {
  validateRetrievalBenchmarkDataset(input.dataset);

  const totals: Aggregate = {
    recallAtK: 0,
    reciprocalRank: 0,
    hitAtK: 0
  };
  const byUseCase = new Map<RetrievalBenchmarkUseCase, Aggregate & { caseCount: number }>();

  for (const benchmarkCase of input.dataset.cases) {
    const response = await input.engine.search({
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
    const caseRecall = recallAtK(returnedIds, benchmarkCase.relevantDocumentIds);
    const caseReciprocalRank = reciprocalRank(returnedIds, relevantIds);
    const caseHitAtK = hitAtK(returnedIds, relevantIds);

    totals.recallAtK += caseRecall;
    totals.reciprocalRank += caseReciprocalRank;
    totals.hitAtK += caseHitAtK;

    const useCaseAggregate = byUseCase.get(benchmarkCase.useCase) ?? {
      caseCount: 0,
      recallAtK: 0,
      reciprocalRank: 0,
      hitAtK: 0
    };
    useCaseAggregate.caseCount += 1;
    useCaseAggregate.recallAtK += caseRecall;
    useCaseAggregate.reciprocalRank += caseReciprocalRank;
    useCaseAggregate.hitAtK += caseHitAtK;
    byUseCase.set(benchmarkCase.useCase, useCaseAggregate);
  }

  return {
    datasetId: input.dataset.id,
    datasetName: input.dataset.name,
    engineName: input.engineName,
    topK: input.topK,
    caseCount: input.dataset.cases.length,
    recallAtK: average(totals.recallAtK, input.dataset.cases.length),
    mrr: average(totals.reciprocalRank, input.dataset.cases.length),
    hitAtK: average(totals.hitAtK, input.dataset.cases.length),
    breakdown: Array.from(byUseCase.entries())
      .map(([useCase, aggregate]) => ({
        useCase,
        caseCount: aggregate.caseCount,
        recallAtK: average(aggregate.recallAtK, aggregate.caseCount),
        mrr: average(aggregate.reciprocalRank, aggregate.caseCount),
        hitAtK: average(aggregate.hitAtK, aggregate.caseCount)
      }))
      .sort((left, right) => left.useCase.localeCompare(right.useCase))
  };
}
