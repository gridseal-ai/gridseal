import { Hono } from "hono";
import type { StorageAdapter } from "@gridseal/core";
import { createCertificate, verifyCertificate } from "@gridseal/core";
import { createCertificateSchema } from "../validation/schemas.js";
import { parseBody } from "../middleware/validate.js";

export function createCertificateRoutes(storage: StorageAdapter): Hono {
  const app = new Hono();

  /** Create a reasoning certificate. */
  app.post("/", async (c) => {
    const parsed = await parseBody(c, createCertificateSchema);
    if (!parsed.ok) {
      return parsed.response;
    }
    const certificate = createCertificate(parsed.value);
    const result = await storage.putCertificate(certificate);
    if (!result.ok) {
      return c.json(
        {
          error: `Failed to store certificate: ${result.error.type}`,
          details: result.error,
        },
        409
      );
    }
    return c.json({ certificate }, 201);
  });

  /** Get a reasoning certificate by ID. */
  app.get("/:certificateId", async (c) => {
    const certificateId = c.req.param("certificateId");
    const result = await storage.getCertificate(certificateId);
    if (!result.ok) {
      return c.json(
        { error: `Certificate not found: ${certificateId}` },
        404
      );
    }
    return c.json({ certificate: result.value });
  });

  /** Verify a certificate's hash integrity. */
  app.post("/:certificateId/verify", async (c) => {
    const certificateId = c.req.param("certificateId");
    const result = await storage.getCertificate(certificateId);
    if (!result.ok) {
      return c.json(
        { error: `Certificate not found: ${certificateId}` },
        404
      );
    }
    const valid = verifyCertificate(result.value);
    return c.json({ valid, certificateId });
  });

  return app;
}
