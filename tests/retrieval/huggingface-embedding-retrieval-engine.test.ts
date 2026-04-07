import { describe, expect, it, vi } from "vitest";
import { HuggingFaceEmbeddingRetrievalEngine } from "../../src/adapters/huggingface/huggingface-embedding-retrieval-engine.js";

describe("HuggingFaceEmbeddingRetrievalEngine", () => {
  it("ranks corpus documents using returned embedding similarity", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      return new Response(
        JSON.stringify([
          [1, 0],
          [0.9, 0.1],
          [0.1, 0.9]
        ]),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });

    const engine = new HuggingFaceEmbeddingRetrievalEngine({
      endpointUrl: "https://embeddings.sellora.test/embed",
      model: "intfloat/multilingual-e5-small",
      apiToken: "hf_test",
      fetchImpl
    });

    const result = await engine.search({
      query: {
        text: "refund payment",
        language: "en",
        topK: 2
      },
      corpus: [
        {
          id: "doc_refund",
          language: "en",
          title: "Refund guide",
          body: "Duplicate charge refunds"
        },
        {
          id: "doc_shipping",
          language: "en",
          title: "Shipping help",
          body: "Track a shipment"
        }
      ]
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://embeddings.sellora.test/embed",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer hf_test"
        }),
        body: JSON.stringify({
          model: "intfloat/multilingual-e5-small",
          inputs: ["query: refund payment", "passage: Refund guide\nDuplicate charge refunds", "passage: Shipping help\nTrack a shipment"],
          normalize: true,
          truncate: true
        })
      })
    );
    expect(result.hits.map((hit) => hit.documentId)).toEqual(["doc_refund", "doc_shipping"]);
    expect(result.hits[0]?.rank).toBe(1);
  });

  it("accepts embedding envelopes with a data field", async () => {
    const engine = new HuggingFaceEmbeddingRetrievalEngine({
      endpointUrl: "https://embeddings.sellora.test/embed",
      model: "intfloat/multilingual-e5-small",
      fetchImpl: vi.fn<typeof fetch>(async () =>
        new Response(
          JSON.stringify({
            data: [
              { embedding: [1, 0] },
              { embedding: [0.9, 0.1] }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    });

    const result = await engine.search({
      query: {
        text: "refund payment",
        topK: 1
      },
      corpus: [
        {
          id: "doc_refund",
          language: "en",
          body: "Duplicate charge refunds"
        }
      ]
    });

    expect(result.hits[0]?.documentId).toBe("doc_refund");
  });

  it("throws on upstream failures", async () => {
    const engine = new HuggingFaceEmbeddingRetrievalEngine({
      endpointUrl: "https://embeddings.sellora.test/embed",
      model: "intfloat/multilingual-e5-small",
      fetchImpl: vi.fn<typeof fetch>(async () => new Response("bad", { status: 503 }))
    });

    await expect(
      engine.search({
        query: {
          text: "refund payment",
          topK: 1
        },
        corpus: [
          {
            id: "doc_refund",
            language: "en",
            body: "Duplicate charge refunds"
          }
        ]
      })
    ).rejects.toThrow("Hugging Face embeddings request failed: 503");
  });

  it("rejects inconsistent embedding dimensions", async () => {
    const engine = new HuggingFaceEmbeddingRetrievalEngine({
      endpointUrl: "https://embeddings.sellora.test/embed",
      model: "intfloat/multilingual-e5-small",
      fetchImpl: vi.fn<typeof fetch>(async () =>
        new Response(JSON.stringify([[1, 0], [0.9]]), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
    });

    await expect(
      engine.search({
        query: {
          text: "refund payment",
          topK: 1
        },
        corpus: [
          {
            id: "doc_refund",
            language: "en",
            body: "Duplicate charge refunds"
          }
        ]
      })
    ).rejects.toThrow("inconsistent vector dimensions");
  });
});
