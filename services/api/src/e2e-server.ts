/**
 * Combined E2E test server: API + dashboard static files on port 3099.
 * Used by Playwright tests. Runs in single-tenant mode with in-memory storage.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createInMemoryAdapter } from "@gridseal/core";
import { createApp } from "./app.js";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const port = 3099;
const DASHBOARD_DIR = join(import.meta.dirname, "../../dashboard/dist");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const root = new Hono();

const storage = createInMemoryAdapter();
const api = createApp({
  storage,
  corsOrigins: ["*"],
  apiKeys: [],
  badgeBaseUrl: `http://localhost:${String(port)}/api`,
});

root.route("/api", api);

root.get("/*", (c) => {
  let reqPath = new URL(c.req.url).pathname;
  if (reqPath === "/") {
    reqPath = "/index.html";
  }
  const filePath = join(DASHBOARD_DIR, reqPath);
  if (existsSync(filePath)) {
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    const content = readFileSync(filePath);
    return c.body(content, 200, { "Content-Type": contentType });
  }
  // SPA fallback: serve index.html for client-side routes
  const indexPath = join(DASHBOARD_DIR, "index.html");
  if (existsSync(indexPath)) {
    const content = readFileSync(indexPath);
    return c.body(content, 200, { "Content-Type": "text/html" });
  }
  return c.text("Not found", 404);
});

serve({ fetch: root.fetch, port }, (info) => {
  process.stdout.write(
    `E2E test server listening on http://localhost:${String(info.port)}\n`,
  );
});
