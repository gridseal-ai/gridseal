import { serve } from "@hono/node-server";
import { createInMemoryAdapter } from "@gridseal/core";
import { createApp } from "./app.js";

const port = Number(process.env["PORT"] ?? 3000);
const corsOrigins = process.env["CORS_ORIGINS"]?.split(",") ?? [];

const storage = createInMemoryAdapter();
const app = createApp({ storage, corsOrigins });

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(
    `GridSeal API listening on http://localhost:${String(info.port)}\n`
  );
});
