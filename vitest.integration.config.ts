import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
    maxWorkers: 1,
    fileParallelism: false
  }
});
