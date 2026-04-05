import { Hono } from "hono";
import type { StorageAdapter } from "@gridseal/core";
import {
  generateComplianceReport,
  getRegulationById,
  getRegulationIds,
} from "@gridseal/core";
import type { EntryMetadata } from "@gridseal/core";
import { reportQuerySchema } from "../validation/schemas.js";
import { parseQuery } from "../middleware/validate.js";
import crypto from "node:crypto";

/** Default metadata applied when no overrides are provided. */
const DEFAULT_METADATA: EntryMetadata = {
  sectors: [],
  dataTypes: [],
  authorityLevel: null,
  riskLevel: null,
};

export function createReportRoutes(storage: StorageAdapter): Hono {
  const app = new Hono();

  /** List available regulation IDs. */
  app.get("/", (c) => {
    const ids = getRegulationIds();
    return c.json({ regulations: ids });
  });

  /** Generate a compliance report for a specific regulation. */
  app.get("/:regulation", async (c) => {
    const regulation = c.req.param("regulation");

    const reg = getRegulationById(regulation);
    if (!reg) {
      return c.json(
        {
          error: `Unknown regulation: ${regulation}`,
          available: [...getRegulationIds()],
        },
        404,
      );
    }

    const parsed = parseQuery(c, reportQuerySchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const { chainId } = parsed.value as { chainId: string };

    const entries = await storage.getEntriesByChainId(chainId);
    if (entries.length === 0) {
      return c.json({ error: `Chain not found: ${chainId}` }, 404);
    }

    const chain = { chainId, entries: [...entries] };
    const reportId = crypto.randomUUID();

    const report = generateComplianceReport({
      reportId,
      chain,
      defaultMetadata: DEFAULT_METADATA,
      regulationIds: [regulation],
    });

    return c.json({ report });
  });

  return app;
}
