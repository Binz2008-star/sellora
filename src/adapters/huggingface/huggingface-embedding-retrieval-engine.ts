import type {
  RetrievalDocument,
  RetrievalScoredDocument,
  RetrievalSearchResult
} from "../../domain/retrieval/retrieval.js";
import type { RetrievalEngine, RetrievalSearchInput } from "../../ports/retrieval-engine.js";

export interface HuggingFaceEmbeddingRetrievalEngineOptions {
  endpointUrl: string;
  model: string;
  apiToken?: string;
  fetchImpl?: typeof fetch;
}

interface EmbeddingResponseItem {
  embedding?: number[];
}

interface EmbeddingEnvelope {
  data?: unknown;
  embeddings?: unknown;
 }

function dotProduct(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function magnitude(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(left: number[], right: number[]): number {
  const denominator = magnitude(left) * magnitude(right);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct(left, right) / denominator;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatQueryText(text: string): string {
  return `query: ${normalizeText(text)}`;
}

function formatPassageText(document: RetrievalDocument): string {
  const title = document.title ? `${normalizeText(document.title)}\n` : "";
  return `passage: ${title}${normalizeText(document.body)}`;
}

function asEmbeddingList(payload: unknown): number[][] {
  const normalizedPayload =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as EmbeddingEnvelope).embeddings ?? (payload as EmbeddingEnvelope).data
      : payload;

  if (!Array.isArray(normalizedPayload)) {
    throw new Error("Invalid embedding response payload");
  }

  if (normalizedPayload.length === 0) {
    return [];
  }

  if (Array.isArray(normalizedPayload[0])) {
    return (normalizedPayload as unknown[]).map((item) => {
      if (!Array.isArray(item) || item.some((value) => typeof value !== "number")) {
        throw new Error("Invalid embedding vector payload");
      }

      return item as number[];
    });
  }

  return (normalizedPayload as EmbeddingResponseItem[]).map((item) => {
    if (!Array.isArray(item.embedding) || item.embedding.some((value) => typeof value !== "number")) {
      throw new Error("Invalid embedding object payload");
    }

    return item.embedding;
  });
}

function assertCompatibleEmbeddings(embeddings: number[][]): void {
  const dimension = embeddings[0]?.length ?? 0;

  for (const embedding of embeddings) {
    if (embedding.length !== dimension) {
      throw new Error("Embedding response contained inconsistent vector dimensions");
    }
  }
}

export class HuggingFaceEmbeddingRetrievalEngine implements RetrievalEngine {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HuggingFaceEmbeddingRetrievalEngineOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async search(input: RetrievalSearchInput): Promise<RetrievalSearchResult> {
    const queryText = formatQueryText(input.query.text);
    const passages = input.corpus.map((document) => formatPassageText(document));
    const embeddings = await this.embed([queryText, ...passages]);

    if (embeddings.length !== input.corpus.length + 1) {
      throw new Error(`Expected ${input.corpus.length + 1} embeddings, received ${embeddings.length}`);
    }

    const queryEmbedding = embeddings[0];
    const hits: RetrievalScoredDocument[] = input.corpus
      .map((document, index) => ({
        documentId: document.id,
        score: cosineSimilarity(queryEmbedding, embeddings[index + 1]),
        rank: index + 1
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, input.query.topK)
      .map((hit, index) => ({
        ...hit,
        rank: index + 1
      }));

    return {
      query: input.query,
      hits
    };
  }

  private async embed(inputs: string[]): Promise<number[][]> {
    const response = await this.fetchImpl(this.options.endpointUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(this.options.apiToken ? { authorization: `Bearer ${this.options.apiToken}` } : {})
      },
      body: JSON.stringify({
        model: this.options.model,
        inputs,
        normalize: true,
        truncate: true
      })
    });

    if (!response.ok) {
      throw new Error(`Hugging Face embeddings request failed: ${response.status}`);
    }

    const embeddings = asEmbeddingList(await response.json());
    assertCompatibleEmbeddings(embeddings);
    return embeddings;
  }
}
