import type { AppConfig } from "../../core/config.js";
import { HuggingFaceEmbeddingRetrievalEngine } from "../../adapters/huggingface/huggingface-embedding-retrieval-engine.js";
import { LexicalRetrievalEngine } from "../../adapters/memory/lexical-retrieval-engine.js";
import type { RetrievalEngine } from "../../ports/retrieval-engine.js";

export function createRetrievalEngine(config: AppConfig): RetrievalEngine {
  if (config.RETRIEVAL_PROVIDER === "huggingface") {
    return new HuggingFaceEmbeddingRetrievalEngine({
      endpointUrl: config.HUGGINGFACE_EMBEDDINGS_URL!,
      model: config.HUGGINGFACE_EMBEDDINGS_MODEL,
      apiToken: config.HUGGINGFACE_API_TOKEN
    });
  }

  return new LexicalRetrievalEngine();
}
