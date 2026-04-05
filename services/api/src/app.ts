import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import type { StorageAdapter } from "@gridseal/core";
import { createHealthRoutes } from "./routes/health.js";
import { createChainRoutes } from "./routes/chains.js";
import { createCertificateRoutes } from "./routes/certificates.js";
import { createProvenanceRoutes } from "./routes/provenance.js";
import { createReportRoutes } from "./routes/reports.js";
import { errorHandler } from "./middleware/error-handler.js";
import { apiKeyAuth } from "./middleware/auth.js";

export type AppConfig = {
  readonly storage: StorageAdapter;
  readonly corsOrigins?: ReadonlyArray<string> | undefined;
  readonly apiKeys?: ReadonlyArray<string> | undefined;
};

/** Create a configured Hono app with all routes mounted. */
export function createApp(config: AppConfig): Hono {
  const app = new Hono();

  app.onError(errorHandler);

  app.use(
    "*",
    cors({
      origin: config.corsOrigins
        ? [...config.corsOrigins]
        : [],
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    })
  );

  app.use("*", requestId());

  const keySet = new Set(config.apiKeys ?? []);
  app.use("*", apiKeyAuth({ apiKeys: keySet }));

  app.route("/health", createHealthRoutes());
  app.route("/chains", createChainRoutes(config.storage));
  app.route("/certificates", createCertificateRoutes(config.storage));
  app.route("/provenance", createProvenanceRoutes(config.storage));
  app.route("/reports", createReportRoutes(config.storage));

  app.notFound((c) => {
    return c.json({ error: `Not found: ${c.req.method} ${c.req.path}` }, 404);
  });

  return app;
}
