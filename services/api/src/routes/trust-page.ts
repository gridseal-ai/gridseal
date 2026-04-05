import { Hono } from "hono";
import { generateTrustPage, generateTrustPageData } from "@gridseal/trust-page";
import type { StorageResolver } from "../app.js";

export function createTrustPageRoutes(
  resolveStorage: StorageResolver,
): Hono {
  const app = new Hono();

  /** Generate and serve a Trust Page as HTML for a chain. */
  app.get("/:chainId/trust", async (c) => {
    const storage = resolveStorage(c);
    const chainId = c.req.param("chainId");
    const result = await generateTrustPage(storage, { chainId });
    if (!result.ok) {
      if (result.error.type === "CHAIN_EMPTY") {
        return c.json({ error: `Chain not found: ${chainId}` }, 404);
      }
      return c.json(
        { error: `Failed to generate trust page: ${result.error.message}` },
        500,
      );
    }
    return c.html(result.value.html);
  });

  /** Return trust page data as JSON for a chain. */
  app.get("/:chainId/trust/data", async (c) => {
    const storage = resolveStorage(c);
    const chainId = c.req.param("chainId");
    const result = await generateTrustPageData(storage, { chainId });
    if (!result.ok) {
      if (result.error.type === "CHAIN_EMPTY") {
        return c.json({ error: `Chain not found: ${chainId}` }, 404);
      }
      return c.json(
        { error: `Failed to generate trust page data: ${result.error.message}` },
        500,
      );
    }
    return c.json({ data: result.value });
  });

  return app;
}
