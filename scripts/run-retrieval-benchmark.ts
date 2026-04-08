#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";

interface BenchmarkQuery {
  id: string;
  text: string;
  category: string;
  expected_results: string[];
}

interface BenchmarkProduct {
  id: string;
  title: string;
  description: string;
  category: string;
  attributes: Record<string, string>;
}

interface BenchmarkDataset {
  version: string;
  dataset: string;
  queries: BenchmarkQuery[];
  products: BenchmarkProduct[];
}

interface RetrievalResult {
  product_id: string;
  score: number;
}

interface BenchmarkMetrics {
  recall_at_k: Record<number, number>;
  hit_at_k: Record<number, number>;
  mean_reciprocal_rank: number;
  per_category_metrics: Record<string, Partial<BenchmarkMetrics>>;
}

class LexicalRetriever {
  private products: BenchmarkProduct[];

  constructor(products: BenchmarkProduct[]) {
    this.products = products;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\s+/).filter(token => token.length > 0);
  }

  private calculateScore(queryTokens: string[], product: BenchmarkProduct): number {
    const productText = `${product.title} ${product.description} ${Object.values(product.attributes).join(' ')}`;
    const productTokens = this.tokenize(productText);

    const querySet = new Set(queryTokens);
    const productSet = new Set(productTokens);

    const intersection = new Set(Array.from(querySet).filter(token => productSet.has(token)));
    const union = new Set([...Array.from(querySet), ...productTokens]);

    return intersection.size / union.size; // Jaccard similarity
  }

  search(query: string, limit: number = 10): RetrievalResult[] {
    const queryTokens = this.tokenize(query);

    const results = this.products
      .map(product => ({
        product_id: product.id,
        score: this.calculateScore(queryTokens, product)
      }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }
}

class BenchmarkRunner {
  private dataset: BenchmarkDataset;
  private retriever: LexicalRetriever;

  constructor(datasetPath: string) {
    const datasetContent = readFileSync(datasetPath, 'utf-8');
    this.dataset = JSON.parse(datasetContent) as BenchmarkDataset;
    this.retriever = new LexicalRetriever(this.dataset.products);
  }

  private calculateRecallAtK(retrieved: RetrievalResult[], expected: string[], k: number): number {
    const retrievedIds = retrieved.slice(0, k).map(r => r.product_id);
    const expectedSet = new Set(expected);
    const relevantRetrieved = retrievedIds.filter(id => expectedSet.has(id));
    return relevantRetrieved.length / expected.length;
  }

  private calculateHitAtK(retrieved: RetrievalResult[], expected: string[], k: number): number {
    const retrievedIds = retrieved.slice(0, k).map(r => r.product_id);
    const expectedSet = new Set(expected);
    return retrievedIds.some(id => expectedSet.has(id)) ? 1 : 0;
  }

  private calculateMRR(retrieved: RetrievalResult[], expected: string[]): number {
    const expectedSet = new Set(expected);
    for (let i = 0; i < retrieved.length; i++) {
      if (Array.from(expectedSet).includes(retrieved[i].product_id)) {
        return 1 / (i + 1);
      }
    }
    return 0;
  }

  private runSingleQuery(query: BenchmarkQuery): Partial<BenchmarkMetrics> {
    const results = this.retriever.search(query.text);

    const kValues = [1, 3, 5, 10];
    const recallAtK: Record<number, number> = {};
    const hitAtK: Record<number, number> = {};

    for (const k of kValues) {
      recallAtK[k] = this.calculateRecallAtK(results, query.expected_results, k);
      hitAtK[k] = this.calculateHitAtK(results, query.expected_results, k);
    }

    const mrr = this.calculateMRR(results, query.expected_results);

    return {
      recall_at_k: recallAtK,
      hit_at_k: hitAtK,
      mean_reciprocal_rank: mrr
    };
  }

  runBenchmark(): BenchmarkMetrics {
    const queryResults = this.dataset.queries.map(query => ({
      query,
      metrics: this.runSingleQuery(query)
    }));

    // Aggregate metrics across all queries
    const kValues = [1, 3, 5, 10];
    const recallAtK: Record<number, number> = {};
    const hitAtK: Record<number, number> = {};
    let totalMRR = 0;

    for (const k of kValues) {
      recallAtK[k] = queryResults.reduce((sum, qr) => sum + (qr.metrics.recall_at_k?.[k] || 0), 0) / queryResults.length;
      hitAtK[k] = queryResults.reduce((sum, qr) => sum + (qr.metrics.hit_at_k?.[k] || 0), 0) / queryResults.length;
    }

    totalMRR = queryResults.reduce((sum, qr) => sum + (qr.metrics.mean_reciprocal_rank || 0), 0) / queryResults.length;

    // Per-category breakdown
    const perCategoryMetrics: Record<string, Partial<BenchmarkMetrics>> = {};
    const categories = [...new Set(this.dataset.queries.map(q => q.category))];

    for (const category of categories) {
      const categoryQueries = queryResults.filter(qr => qr.query.category === category);

      const categoryRecallAtK: Record<number, number> = {};
      const categoryHitAtK: Record<number, number> = {};
      let categoryMRR = 0;

      for (const k of kValues) {
        categoryRecallAtK[k] = categoryQueries.reduce((sum, qr) => sum + (qr.metrics.recall_at_k?.[k] || 0), 0) / categoryQueries.length;
        categoryHitAtK[k] = categoryQueries.reduce((sum, qr) => sum + (qr.metrics.hit_at_k?.[k] || 0), 0) / categoryQueries.length;
      }

      categoryMRR = categoryQueries.reduce((sum, qr) => sum + (qr.metrics.mean_reciprocal_rank || 0), 0) / categoryQueries.length;

      perCategoryMetrics[category] = {
        recall_at_k: categoryRecallAtK,
        hit_at_k: categoryHitAtK,
        mean_reciprocal_rank: categoryMRR
      };
    }

    return {
      recall_at_k: recallAtK,
      hit_at_k: hitAtK,
      mean_reciprocal_rank: totalMRR,
      per_category_metrics: perCategoryMetrics
    };
  }
}

// Main execution
function main() {
  const datasetPath = join(process.cwd(), 'src', 'fixtures', 'retrieval', 'benchmark.v1.json');
  const runner = new BenchmarkRunner(datasetPath);

  console.log('Running Retrieval Benchmark...\n');

  const metrics = runner.runBenchmark();

  console.log('=== BENCHMARK RESULTS ===');
  console.log(`Dataset: ${runner['dataset'].dataset}`);
  console.log(`Queries: ${runner['dataset'].queries.length}`);
  console.log(`Products: ${runner['dataset'].products.length}\n`);

  console.log('--- Overall Metrics ---');
  console.log('Recall@K:', metrics.recall_at_k);
  console.log('Hit@K:', metrics.hit_at_k);
  console.log(`MRR: ${metrics.mean_reciprocal_rank.toFixed(4)}\n`);

  console.log('--- Per-Category Metrics ---');
  for (const [category, categoryMetrics] of Object.entries(metrics.per_category_metrics)) {
    console.log(`\n${category.toUpperCase()}:`);
    console.log('  Recall@K:', categoryMetrics.recall_at_k);
    console.log('  Hit@K:', categoryMetrics.hit_at_k);
    console.log(`  MRR: ${(categoryMetrics.mean_reciprocal_rank || 0).toFixed(4)}`);
  }
}

main();
