import { Hono } from "hono";
import { computeBadgeData, renderBadgeSvg } from "@gridseal/trust-page";
import type { StorageFactory } from "../storage-factory.js";

/**
 * Create badge routes that serve SVG badges for tenant chains.
 * These routes are PUBLIC (no authentication required) since
 * badges are embedded on external websites.
 */
export function createBadgeRoutes(
  storageFactory: StorageFactory,
  baseUrl: string,
): Hono {
  const app = new Hono();

  /**
   * GET /badge/:tenantSlug.svg
   *
   * Returns an SVG badge showing chain integrity status.
   * Optional query param: ?chain=<chainId> to check a specific chain.
   * The badge links to the tenant's trust page.
   */
  app.get("/:file", async (c) => {
    const rawFile = c.req.param("file");
    if (!rawFile.endsWith(".svg")) {
      return c.text("Not found", 404);
    }
    const tenantSlug = decodeURIComponent(rawFile.slice(0, -4));

    if (!/^[\w-]+$/.test(tenantSlug)) {
      return c.text("Invalid tenant slug", 400);
    }

    const chainId = c.req.query("chain") ?? undefined;
    const storage = storageFactory(tenantSlug);

    const data = await computeBadgeData(storage, {
      tenantSlug,
      chainId,
      baseUrl,
    });

    const svg = renderBadgeSvg(data);

    return c.body(svg, 200, {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    });
  });

  return app;
}
