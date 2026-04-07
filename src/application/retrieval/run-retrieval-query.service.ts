import type { RetrievalSearchResult } from "../../domain/retrieval/retrieval.js";
import type { RetrievalEngine } from "../../ports/retrieval-engine.js";

export interface RunRetrievalQueryRequest {
  query: string;
  language?: string;
  topK?: number;
  corpus: Array<{
    id: string;
    language: string;
    title?: string;
    body: string;
    metadata?: Record<string, unknown>;
  }>;
}

const DEFAULT_TOP_K = 10;

export class RunRetrievalQueryService {
  constructor(
    private readonly retrievalEngine: RetrievalEngine,
    private readonly defaultTopK: number = DEFAULT_TOP_K
  ) {}

  async execute(input: RunRetrievalQueryRequest): Promise<RetrievalSearchResult> {
    return this.retrievalEngine.search({
      query: {
        text: input.query.trim(),
        language: input.language?.trim(),
        topK: input.topK ?? this.defaultTopK
      },
      corpus: input.corpus
    });
  }
}
