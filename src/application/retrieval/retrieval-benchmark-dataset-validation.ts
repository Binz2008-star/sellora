import type { RetrievalBenchmarkDataset } from "../../domain/retrieval/retrieval.js";

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return Array.from(duplicates).sort((left, right) => left.localeCompare(right));
}

export function validateRetrievalBenchmarkDataset(dataset: RetrievalBenchmarkDataset): void {
  const corpusIds = dataset.corpus.map((document) => document.id);
  const caseIds = dataset.cases.map((benchmarkCase) => benchmarkCase.id);
  const duplicateCorpusIds = findDuplicates(corpusIds);
  const duplicateCaseIds = findDuplicates(caseIds);

  if (duplicateCorpusIds.length > 0) {
    throw new Error(
      `Retrieval benchmark contains duplicate corpus document ids: ${duplicateCorpusIds.join(", ")}`
    );
  }

  if (duplicateCaseIds.length > 0) {
    throw new Error(
      `Retrieval benchmark contains duplicate case ids: ${duplicateCaseIds.join(", ")}`
    );
  }

  const corpusIdSet = new Set(corpusIds);

  for (const benchmarkCase of dataset.cases) {
    const missingRelevantDocumentIds = benchmarkCase.relevantDocumentIds.filter(
      (documentId) => !corpusIdSet.has(documentId)
    );

    if (missingRelevantDocumentIds.length > 0) {
      throw new Error(
        `Retrieval benchmark case ${benchmarkCase.id} references unknown relevant document ids: ${missingRelevantDocumentIds.join(", ")}`
      );
    }

    if (
      benchmarkCase.expectedPrimaryDocumentId &&
      !benchmarkCase.relevantDocumentIds.includes(benchmarkCase.expectedPrimaryDocumentId)
    ) {
      throw new Error(
        `Retrieval benchmark case ${benchmarkCase.id} expectedPrimaryDocumentId must also be listed as relevant`
      );
    }
  }
}
