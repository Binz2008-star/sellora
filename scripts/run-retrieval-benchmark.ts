import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HuggingFaceEmbeddingRetrievalEngine } from "../src/adapters/huggingface/huggingface-embedding-retrieval-engine.js";
import { LexicalRetrievalEngine } from "../src/adapters/memory/lexical-retrieval-engine.js";
import { generateRetrievalBenchmarkReport } from "../src/application/retrieval/retrieval-benchmark-report.js";
import { loadConfig } from "../src/core/config.js";
import type { RetrievalBenchmarkDataset } from "../src/domain/retrieval/retrieval.js";
import type { RetrievalEngine } from "../src/ports/retrieval-engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_FIXTURE_PATH = path.resolve(
  __dirname,
  "..",
  "src",
  "fixtures",
  "retrieval",
  "benchmark.v1.json"
);
const DEFAULT_TOP_K = 5;

async function loadBenchmark(filePath: string): Promise<RetrievalBenchmarkDataset> {
  return JSON.parse(await readFile(filePath, "utf8")) as RetrievalBenchmarkDataset;
}

function parseTopK(input?: string): number {
  if (!input) {
    return DEFAULT_TOP_K;
  }

  const value = Number.parseInt(input, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid topK value: ${input}`);
  }

  return value;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

function formatUseCaseLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function createConfiguredEngines(): Array<{ name: string; engine: RetrievalEngine }> {
  const engines: Array<{ name: string; engine: RetrievalEngine }> = [
    {
      name: "lexical",
      engine: new LexicalRetrievalEngine()
    }
  ];

  try {
    const config = loadConfig();
    if (config.HUGGINGFACE_EMBEDDINGS_URL) {
      engines.push({
        name: "hf-e5",
        engine: new HuggingFaceEmbeddingRetrievalEngine({
          endpointUrl: config.HUGGINGFACE_EMBEDDINGS_URL,
          model: config.HUGGINGFACE_EMBEDDINGS_MODEL,
          apiToken: config.HUGGINGFACE_API_TOKEN
        })
      });
    }
  } catch {
    return engines;
  }

  return engines;
}

async function main(): Promise<void> {
  const benchmarkPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FIXTURE_PATH;
  const topK = parseTopK(process.argv[3]);
  const dataset = await loadBenchmark(benchmarkPath);
  const engines = createConfiguredEngines();

  for (const entry of engines) {
    const report = await generateRetrievalBenchmarkReport({
      dataset,
      engine: entry.engine,
      engineName: entry.name,
      topK
    });

    console.log(`Engine: ${report.engineName}`);
    console.log("-".repeat(17));
    console.log(`Dataset: ${report.datasetName}`);
    console.log(`Cases: ${report.caseCount}`);
    console.log(`Recall@${report.topK}: ${formatScore(report.recallAtK)}`);
    console.log(`MRR: ${formatScore(report.mrr)}`);
    console.log(`Hit@${report.topK}: ${formatScore(report.hitAtK)}`);
    console.log("");
    console.log("Breakdown:");

    for (const breakdown of report.breakdown) {
      console.log(
        `${formatUseCaseLabel(breakdown.useCase)}: recall@${report.topK} ${formatScore(breakdown.recallAtK)}, mrr ${formatScore(breakdown.mrr)}, hit@${report.topK} ${formatScore(breakdown.hitAtK)}`
      );
    }

    console.log("");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown benchmark runner error";
  console.error(message);
  process.exitCode = 1;
});
