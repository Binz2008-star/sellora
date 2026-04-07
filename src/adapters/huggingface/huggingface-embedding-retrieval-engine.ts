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
  if (!Array.isArray(payload)) {
    throw new Error("Invalid embedding response payload");
  }

  if (payload.length === 0) {
    return [];
  }

  if (Array.isArray(payload[0])) {
    return (payload as unknown[]).map((item) => {
      if (!Array.isArray(item) || item.some((value) => typeof value !== "number")) {
        throw new Error("Invalid embedding vector payload");
      }

      return item as number[];
    });
  }

  return (payload as EmbeddingResponseItem[]).map((item) => {
    if (!Array.isArray(item.embedding) || item.embedding.some((value) => typeof value !== "number")) {
      throw new Error("Invalid embedding object payload");
    }

    return item.embedding;
  });
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
        "content-type": "application/json",
        ...(this.options.apiToken ? { authorization: `Bearer ${this.options.apiToken}` } : {})
      },
      body: JSON.stringify({
        inputs,
        normalize: true,
        truncate: true
      })
    });

    if (!response.ok) {
      throw new Error(`Hugging Face embeddings request failed: ${response.status}`);
    }

    return asEmbeddingList(await response.json());
  }
}
