import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTenantApp } from "../../src/app.js";
import { createTenantSqliteAdapter } from "../../src/db/tenant-sqlite-adapter.js";
import { createTenantToken } from "../../src/jwt.js";
import type { Hono } from "hono";
import type { TenantSqliteHandle } from "../../src/db/tenant-sqlite-adapter.js";

const JWT_SECRET = "malformed-test-secret";
const TENANT = "malformed-tenant";

function authHeader(tenantId: string): { Authorization: string } {
  const token = createTenantToken(tenantId, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

function post(app: Hono, path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(TENANT) },
    body: JSON.stringify(body),
  });
}

function postRaw(app: Hono, path: string, rawBody: string) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(TENANT) },
    body: rawBody,
  });
}

describe("Malformed input handling", () => {
  let dbHandle: TenantSqliteHandle;
  let app: Hono;

  beforeEach(() => {
    dbHandle = createTenantSqliteAdapter();
    app = createTenantApp({
      storageFactory: dbHandle.forTenant,
      jwtSecret: JWT_SECRET,
    });
  });

  afterEach(() => {
    dbHandle.close();
  });

  describe("invalid JSON payloads", () => {
    it("rejects completely invalid JSON with 400", async () => {
      const res = await postRaw(app, "/chains/test-chain/entries", "{{{not json");
      expect(res.status).toBe(400);
    });

    it("rejects empty body with 400", async () => {
      const res = await postRaw(app, "/chains/test-chain/entries", "");
      expect(res.status).toBe(400);
    });

    it("rejects non-object JSON (array) with 400", async () => {
      const res = await postRaw(app, "/chains/test-chain/entries", "[1,2,3]");
      expect(res.status).toBe(400);
    });

    it("rejects null body with 400", async () => {
      const res = await postRaw(app, "/chains/test-chain/entries", "null");
      expect(res.status).toBe(400);
    });
  });

  describe("missing required fields", () => {
    it("rejects entry missing entryId", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBeTruthy();
    });

    it("rejects entry missing timestamp", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        entryType: "ai_decision",
      });
      expect(res.status).toBe(400);
    });

    it("rejects entry missing entryType", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      });
      expect(res.status).toBe(400);
    });

    it("rejects certificate missing required fields", async () => {
      const res = await post(app, "/certificates", {
        certificateId: crypto.randomUUID(),
        // missing timestamp, modelId, modelProvider, claims, etc.
      });
      expect(res.status).toBe(400);
    });

    it("rejects provenance missing required fields", async () => {
      const res = await post(app, "/provenance", {
        provenanceId: crypto.randomUUID(),
        // missing all other required fields
      });
      expect(res.status).toBe(400);
    });
  });

  describe("wrong field types", () => {
    it("rejects entry with non-UUID entryId", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: "not-a-uuid",
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
      });
      expect(res.status).toBe(400);
    });

    it("rejects entry with invalid timestamp format", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: "not-a-timestamp",
        entryType: "ai_decision",
      });
      expect(res.status).toBe(400);
    });

    it("rejects entry with invalid entryType", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "invalid_type",
      });
      expect(res.status).toBe(400);
    });

    it("rejects entry with non-hex inputHash", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        inputHash: "not-a-sha256-hex-string",
      });
      expect(res.status).toBe(400);
    });

    it("rejects entry with wrong-length inputHash", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        inputHash: "abcdef1234", // too short
      });
      expect(res.status).toBe(400);
    });

    it("rejects entry with non-number inputTokenCount", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        inputTokenCount: "not-a-number",
      });
      expect(res.status).toBe(400);
    });

    it("rejects entry with negative inputTokenCount", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        inputTokenCount: -5,
      });
      expect(res.status).toBe(400);
    });

    it("rejects entry with confidenceScore > 1", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        confidenceScore: 1.5,
      });
      expect(res.status).toBe(400);
    });

    it("rejects entry with confidenceScore < 0", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        confidenceScore: -0.1,
      });
      expect(res.status).toBe(400);
    });

    it("rejects entry with policyIds as string instead of array", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        policyIds: "not-an-array",
      });
      expect(res.status).toBe(400);
    });

    it("rejects entry with tags as string instead of object", async () => {
      const res = await post(app, "/chains/test-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        tags: "not-an-object",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("SQL injection attempts", () => {
    const sqlInjectionStrings = [
      "'; DROP TABLE entries; --",
      "1; DELETE FROM entries WHERE 1=1; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM entries --",
      "1'; EXEC xp_cmdshell('whoami'); --",
      "' OR 1=1 --",
      "'; INSERT INTO entries VALUES('hack'); --",
      "Robert'); DROP TABLE entries;--",
    ];

    it("safely handles SQL injection in entryType (rejected by schema validation)", async () => {
      for (const injection of sqlInjectionStrings) {
        const res = await post(app, "/chains/test-chain/entries", {
          entryId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          entryType: injection,
        });
        // Should be rejected by validation, not cause DB error
        expect(res.status).toBe(400);
      }
    });

    it("safely handles SQL injection in string fields that accept arbitrary strings", async () => {
      // These fields accept arbitrary strings, so they pass validation
      // but must be safely parameterized in the DB
      for (const injection of sqlInjectionStrings) {
        const res = await post(app, "/chains/test-chain/entries", {
          entryId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          entryType: "ai_decision",
          modelId: injection,
          annotation: injection,
          actorId: injection,
          sessionId: injection,
        });
        // Should succeed (strings are valid) and store safely
        expect(res.status).toBe(201);
      }

      // Verify the data was stored correctly without SQL execution
      const listRes = await app.request(
        "/chains/test-chain/entries?limit=1000",
        { headers: authHeader(TENANT) },
      );
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as {
        entries: Array<{ modelId: string; annotation: string }>;
        total: number;
      };
      expect(listBody.total).toBe(sqlInjectionStrings.length);

      // Each stored value should match the injection string exactly (no execution)
      for (let i = 0; i < sqlInjectionStrings.length; i++) {
        expect(listBody.entries[i]?.modelId).toBe(sqlInjectionStrings[i]);
        expect(listBody.entries[i]?.annotation).toBe(sqlInjectionStrings[i]);
      }

      // Chain must still be valid
      const validateRes = await app.request("/chains/test-chain/validate", {
        method: "POST",
        headers: authHeader(TENANT),
      });
      expect(validateRes.status).toBe(200);
      const validateBody = (await validateRes.json()) as { valid: boolean };
      expect(validateBody.valid).toBe(true);
    });

    it("safely handles SQL injection in chainId URL parameter", async () => {
      for (const injection of sqlInjectionStrings) {
        const encoded = encodeURIComponent(injection);
        const res = await app.request(`/chains/${encoded}/entries`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(TENANT),
          },
          body: JSON.stringify({
            entryId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            entryType: "ai_decision",
          }),
        });
        // Should either succeed (storing with injection as chainId) or fail gracefully
        expect([201, 400, 404]).toContain(res.status);
      }
    });

    it("safely handles SQL injection in query filter parameters", async () => {
      // Seed a valid chain
      await post(app, "/chains/filter-test/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        modelId: "safe-model",
      });

      for (const injection of sqlInjectionStrings) {
        const encoded = encodeURIComponent(injection);
        const res = await app.request(
          `/chains/filter-test/entries?modelId=${encoded}`,
          { headers: authHeader(TENANT) },
        );
        // Should return 200 with 0 results (the injection string does not match any modelId)
        expect(res.status).toBe(200);
        const body = (await res.json()) as { total: number };
        expect(body.total).toBe(0);
      }
    });
  });

  describe("special characters and unicode", () => {
    it("stores and retrieves unicode characters in string fields", async () => {
      const entryId = crypto.randomUUID();
      const res = await post(app, "/chains/unicode-chain/entries", {
        entryId,
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        modelId: "gpt-4o",
        annotation: "Test with unicode: \u00e9\u00e0\u00fc\u00f1 \u4e2d\u6587 \ud83d\ude80 \u0410\u0411\u0412",
        tags: { name: "\u00c9mile Z\u00f2la" },
      });
      expect(res.status).toBe(201);

      const getRes = await app.request(
        `/chains/unicode-chain/entries/${entryId}`,
        { headers: authHeader(TENANT) },
      );
      expect(getRes.status).toBe(200);
      const body = (await getRes.json()) as {
        entry: { annotation: string; tags: Record<string, string> };
      };
      expect(body.entry.annotation).toBe(
        "Test with unicode: \u00e9\u00e0\u00fc\u00f1 \u4e2d\u6587 \ud83d\ude80 \u0410\u0411\u0412",
      );
      expect(body.entry.tags["name"]).toBe("\u00c9mile Z\u00f2la");
    });

    it("handles entries with maximum-length annotation strings", async () => {
      const longAnnotation = "x".repeat(10_000);
      const entryId = crypto.randomUUID();
      const res = await post(app, "/chains/long-chain/entries", {
        entryId,
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        annotation: longAnnotation,
      });
      expect(res.status).toBe(201);

      const getRes = await app.request(
        `/chains/long-chain/entries/${entryId}`,
        { headers: authHeader(TENANT) },
      );
      expect(getRes.status).toBe(200);
      const body = (await getRes.json()) as {
        entry: { annotation: string };
      };
      expect(body.entry.annotation).toBe(longAnnotation);
    });

    it("handles entries with empty optional string fields as null", async () => {
      const entryId = crypto.randomUUID();
      const res = await post(app, "/chains/nulls-chain/entries", {
        entryId,
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        modelId: null,
        modelProvider: null,
        inputHash: null,
        outputHash: null,
        annotation: null,
        sessionId: null,
        actorId: null,
      });
      expect(res.status).toBe(201);

      const getRes = await app.request(
        `/chains/nulls-chain/entries/${entryId}`,
        { headers: authHeader(TENANT) },
      );
      expect(getRes.status).toBe(200);
      const body = (await getRes.json()) as {
        entry: Record<string, unknown>;
      };
      expect(body.entry["modelId"]).toBeNull();
      expect(body.entry["annotation"]).toBeNull();
    });

    it("handles newlines and carriage returns in string fields", async () => {
      const entryId = crypto.randomUUID();
      const annotation = "line1\nline2\rline3\r\nline4";
      const res = await post(app, "/chains/newline-chain/entries", {
        entryId,
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        annotation,
        modelId: "model\nwith\nnewlines",
      });
      expect(res.status).toBe(201);

      const getRes = await app.request(
        `/chains/newline-chain/entries/${entryId}`,
        { headers: authHeader(TENANT) },
      );
      expect(getRes.status).toBe(200);
      const body = (await getRes.json()) as {
        entry: { annotation: string; modelId: string };
      };
      expect(body.entry.annotation).toBe(annotation);
      expect(body.entry.modelId).toBe("model\nwith\nnewlines");
    });
  });

  describe("invalid query parameters", () => {
    it("rejects non-numeric offset", async () => {
      // Seed a chain first
      await post(app, "/chains/query-chain/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
      });

      const res = await app.request(
        "/chains/query-chain/entries?offset=abc",
        { headers: authHeader(TENANT) },
      );
      expect(res.status).toBe(400);
    });

    it("rejects negative offset", async () => {
      await post(app, "/chains/query-chain2/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
      });

      const res = await app.request(
        "/chains/query-chain2/entries?offset=-1",
        { headers: authHeader(TENANT) },
      );
      expect(res.status).toBe(400);
    });

    it("rejects limit of 0", async () => {
      await post(app, "/chains/query-chain3/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
      });

      const res = await app.request(
        "/chains/query-chain3/entries?limit=0",
        { headers: authHeader(TENANT) },
      );
      expect(res.status).toBe(400);
    });

    it("rejects limit exceeding 1000", async () => {
      await post(app, "/chains/query-chain4/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
      });

      const res = await app.request(
        "/chains/query-chain4/entries?limit=1001",
        { headers: authHeader(TENANT) },
      );
      expect(res.status).toBe(400);
    });

    it("rejects invalid date format in startDate", async () => {
      await post(app, "/chains/query-chain5/entries", {
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
      });

      const res = await app.request(
        "/chains/query-chain5/entries?startDate=not-a-date",
        { headers: authHeader(TENANT) },
      );
      expect(res.status).toBe(400);
    });

    it("rejects missing chainId in report query", async () => {
      const res = await app.request("/reports/colorado-sb205", {
        headers: authHeader(TENANT),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("not found routes", () => {
    it("returns 404 for unknown API routes", async () => {
      const res = await app.request("/nonexistent", {
        headers: authHeader(TENANT),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 for unknown methods on known routes", async () => {
      const res = await app.request("/chains", {
        method: "DELETE",
        headers: authHeader(TENANT),
      });
      expect(res.status).toBe(404);
    });
  });
});
