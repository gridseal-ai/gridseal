import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import type { StorageAdapter } from "@gridseal/core";
import { createHealthRoutes } from "./routes/health.js";
import { createChainRoutes } from "./routes/chains.js";
import { createCertificateRoutes } from "./routes/certificates.js";
import { createProvenanceRoutes } from "./routes/provenance.js";
import { createReportRoutes } from "./routes/reports.js";
import { errorHandler } from "./middleware/error-handler.js";
import { tenantAuth, apiKeyAuth } from "./middleware/auth.js";
import type { StorageFactory } from "./storage-factory.js";
import { DEFAULT_TENANT_ID } from "./storage-factory.js";

/** Function that resolves a StorageAdapter from a request context. */
export type StorageResolver = (c: Context) => StorageAdapter;

export type AppConfig = {
  readonly storage: StorageAdapter;
  readonly corsOrigins?: ReadonlyArray<string> | undefined;
  readonly apiKeys?: ReadonlyArray<string> | undefined;
};

export type TenantAppConfig = {
  readonly storageFactory: StorageFactory;
  readonly corsOrigins?: ReadonlyArray<string> | undefined;
  readonly jwtSecret: string;
};

function setupCors(app: Hono, origins: ReadonlyArray<string> | undefined): void {
  app.use(
    "*",
    cors({
      origin: origins ? [...origins] : [],
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );
}

function mountRoutes(app: Hono, resolver: StorageResolver): void {
  app.route("/health", createHealthRoutes());
  app.route("/chains", createChainRoutes(resolver));
  app.route("/certificates", createCertificateRoutes(resolver));
  app.route("/provenance", createProvenanceRoutes(resolver));
  app.route("/reports", createReportRoutes(resolver));

  app.notFound((c) => {
    return c.json({ error: `Not found: ${c.req.method} ${c.req.path}` }, 404);
  });
}

/** Create a configured Hono app with all routes mounted (legacy, no multi-tenancy). */
export function createApp(config: AppConfig): Hono {
  const app = new Hono();

  app.onError(errorHandler);
  setupCors(app, config.corsOrigins);
  app.use("*", requestId());

  const keySet = new Set(config.apiKeys ?? []);
  app.use("*", apiKeyAuth({ apiKeys: keySet }));

  const resolver: StorageResolver = () => config.storage;
  mountRoutes(app, resolver);

  return app;
}

/**
 * Create a multi-tenant Hono app with JWT-based tenant isolation.
 * Each request is authenticated via JWT, and storage is scoped to the tenant.
 */
export function createTenantApp(config: TenantAppConfig): Hono {
  const app = new Hono();

  app.onError(errorHandler);
  setupCors(app, config.corsOrigins);
  app.use("*", requestId());
  app.use("*", tenantAuth({ mode: { type: "jwt", secret: config.jwtSecret } }));

  const resolver: StorageResolver = (c) => {
    const tenantId = (c.get("tenantId") as string | undefined) ?? DEFAULT_TENANT_ID;
    return config.storageFactory(tenantId);
  };
  mountRoutes(app, resolver);

  return app;
}
