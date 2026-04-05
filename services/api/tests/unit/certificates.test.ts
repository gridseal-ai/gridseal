import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryAdapter } from "@gridseal/core";
import type { StorageAdapter } from "@gridseal/core";
import { createApp } from "../../src/app.js";
import type { Hono } from "hono";

function makeCertificateBody(overrides: Record<string, unknown> = {}) {
  return {
    certificateId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    modelId: "gpt-4o",
    modelProvider: "openai",
    claims: [
      {
        claimId: "claim-1",
        statement: "The input data is consistent with training distribution",
        supportingEvidenceIds: ["evidence-1"],
      },
    ],
    supportingEvidence: [
      {
        evidenceId: "evidence-1",
        evidenceType: "data_observation",
        description: "Input features within expected ranges",
        source: null,
      },
    ],
    unsupportedClaims: [],
    assumptions: [
      {
        statement: "Input data is representative of production traffic",
        criticality: "medium" as const,
      },
    ],
    limitations: [
      {
        description: "Model has not been tested on adversarial inputs",
        impact: "May produce incorrect results on edge cases",
      },
    ],
    confidenceAssessment: {
      level: "high" as const,
      score: 0.92,
      rationale: "Strong evidence alignment with training data characteristics",
    },
    ...overrides,
  };
}

describe("Certificate routes", () => {
  let app: Hono;
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
    app = createApp({ storage });
  });

  describe("POST /certificates", () => {
    it("creates a certificate and returns 201 with computed hash", async () => {
      const body = makeCertificateBody();
      const res = await app.request("/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(201);
      const data = (await res.json()) as {
        certificate: {
          certificateId: string;
          certificateHash: string;
        };
      };
      expect(data.certificate.certificateId).toBe(body.certificateId);
      expect(data.certificate.certificateHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("rejects duplicate certificate IDs with 409", async () => {
      const body = makeCertificateBody();
      await app.request("/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await app.request("/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(409);
    });

    it("rejects invalid body with 400", async () => {
      const res = await app.request("/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateId: "bad" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /certificates/:certificateId", () => {
    it("retrieves a stored certificate", async () => {
      const body = makeCertificateBody();
      await app.request("/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await app.request(`/certificates/${body.certificateId}`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        certificate: { certificateId: string };
      };
      expect(data.certificate.certificateId).toBe(body.certificateId);
    });

    it("returns 404 for nonexistent certificate", async () => {
      const res = await app.request(`/certificates/${crypto.randomUUID()}`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /certificates/:certificateId/verify", () => {
    it("verifies a valid certificate", async () => {
      const body = makeCertificateBody();
      await app.request("/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await app.request(
        `/certificates/${body.certificateId}/verify`,
        { method: "POST" }
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as { valid: boolean };
      expect(data.valid).toBe(true);
    });

    it("returns 404 for nonexistent certificate", async () => {
      const res = await app.request(
        `/certificates/${crypto.randomUUID()}/verify`,
        { method: "POST" }
      );
      expect(res.status).toBe(404);
    });
  });
});
