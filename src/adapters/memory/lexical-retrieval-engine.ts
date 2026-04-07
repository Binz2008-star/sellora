import type {
  RetrievalDocument,
  RetrievalScoredDocument,
  RetrievalSearchResult
} from "../../domain/retrieval/retrieval.js";
import type { RetrievalEngine, RetrievalSearchInput } from "../../ports/retrieval-engine.js";

function tokenize(value: string): string[] {
  const tokens = value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  return Array.from(new Set(tokens));
}

function scoreDocument(queryTokens: string[], document: RetrievalDocument): number {
  const haystack = tokenize([document.title ?? "", document.body].join(" "));
  if (haystack.length === 0) {
    return 0;
  }

  const haystackSet = new Set(haystack);
  const overlap = queryTokens.filter((token) => haystackSet.has(token)).length;
  const titleTokens = document.title ? tokenize(document.title) : [];
  const exactTitleBoost =
    titleTokens.length > 0 && queryTokens.some((token) => titleTokens.includes(token)) ? 0.25 : 0;

  return overlap / queryTokens.length + exactTitleBoost;
}

export class LexicalRetrievalEngine implements RetrievalEngine {
  async search(input: RetrievalSearchInput): Promise<RetrievalSearchResult> {
    const queryTokens = tokenize(input.query.text);

    const hits: RetrievalScoredDocument[] = input.corpus
      .map((document) => ({
        documentId: document.id,
        score: queryTokens.length === 0 ? 0 : scoreDocument(queryTokens, document)
      }))
      .filter((document) => document.score > 0)
      .sort((left, right) => right.score - left.score || left.documentId.localeCompare(right.documentId))
      .slice(0, input.query.topK)
      .map((document, index) => ({
        documentId: document.documentId,
        score: Number(document.score.toFixed(6)),
        rank: index + 1
      }));

    return {
      query: input.query,
      hits
    };
  }
}
