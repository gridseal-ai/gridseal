import { Hono } from "hono";
import type { StorageAdapter } from "@gridseal/core";
import { createProvenance, verifyProvenance } from "@gridseal/core";
import { createProvenanceSchema } from "../validation/schemas.js";
import { parseBody } from "../middleware/validate.js";

export function createProvenanceRoutes(storage: StorageAdapter): Hono {
  const app = new Hono();

  /** Create a model provenance record. */
  app.post("/", async (c) => {
    const parsed = await parseBody(c, createProvenanceSchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const provenance = createProvenance(parsed.value);
    const result = await storage.putProvenance(provenance);
    if (!result.ok) {
      return c.json(
        {
          error: `Failed to store provenance: ${result.error.type}`,
          details: result.error,
        },
        409
      );
    }
    return c.json({ provenance }, 201);
  });

  /** Get a model provenance record by ID. */
  app.get("/:provenanceId", async (c) => {
    const provenanceId = c.req.param("provenanceId");
    const result = await storage.getProvenance(provenanceId);
    if (!result.ok) {
      return c.json(
        { error: `Provenance record not found: ${provenanceId}` },
        404
      );
    }
    return c.json({ provenance: result.value });
  });

  /** Verify a provenance record's hash integrity. */
  app.post("/:provenanceId/verify", async (c) => {
    const provenanceId = c.req.param("provenanceId");
    const result = await storage.getProvenance(provenanceId);
    if (!result.ok) {
      return c.json(
        { error: `Provenance record not found: ${provenanceId}` },
        404
      );
    }
    const valid = verifyProvenance(result.value);
    return c.json({ valid, provenanceId });
  });

  return app;
}
