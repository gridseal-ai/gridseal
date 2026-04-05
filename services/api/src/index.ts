import { serve } from "@hono/node-server";
import { createInMemoryAdapter } from "@gridseal/core";
import { createApp, createTenantApp } from "./app.js";
import { createTenantSqliteAdapter } from "./db/tenant-sqlite-adapter.js";

const port = Number(process.env["PORT"] ?? 3000);
const corsOrigins = process.env["CORS_ORIGINS"]?.split(",") ?? [];
const apiKeys = process.env["API_KEYS"]?.split(",").filter(Boolean) ?? [];
const jwtSecret = process.env["JWT_SECRET"] ?? "";
const dbPath = process.env["DB_PATH"];

const multiTenant = jwtSecret.length > 0;

const app = multiTenant
  ? (() => {
      const handle = createTenantSqliteAdapter(dbPath);
      return createTenantApp({
        storageFactory: handle.forTenant,
        corsOrigins,
        jwtSecret,
      });
    })()
  : (() => {
      const storage = createInMemoryAdapter();
      return createApp({ storage, corsOrigins, apiKeys });
    })();

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(
    `GridSeal API listening on http://localhost:${String(info.port)} (${multiTenant ? "multi-tenant" : "single-tenant"})\n`
  );
});
