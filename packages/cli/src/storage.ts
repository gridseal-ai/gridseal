import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createSqliteAdapter } from "@gridseal/core/sqlite";
import type { StorageAdapter } from "@gridseal/core";

/** Resolve and validate a database path, then open a read-only SQLite adapter. */
export function openDatabase(dbPath: string): StorageAdapter {
  const resolved = resolve(dbPath);
  if (!existsSync(resolved)) {
    throw new Error(`Database file not found: ${resolved}`);
  }
  return createSqliteAdapter({ path: resolved });
}
