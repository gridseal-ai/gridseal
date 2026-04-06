import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/regression/**/*.test.ts"],
  },
});
