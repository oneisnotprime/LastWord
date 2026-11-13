import { defineConfig } from "vitest/config";

// Each room test file starts a test server on the same port, so the files run one at a time.
export default defineConfig({ test: { fileParallelism: false } });
