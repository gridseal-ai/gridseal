import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
  },
  {
    entry: { sqlite: "src/sqlite.ts" },
    format: ["esm"],
    dts: true,
    external: ["better-sqlite3"],
  },
]);
