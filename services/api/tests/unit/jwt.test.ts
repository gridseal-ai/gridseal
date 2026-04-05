import { describe, it, expect } from "vitest";
import { createTenantToken, verifyTenantToken } from "../../src/jwt.js";

const SECRET = "test-secret-key-for-jwt-signing";

describe("JWT tenant tokens", () => {
  describe("createTenantToken", () => {
    it("creates a valid three-part JWT string", () => {
      const token = createTenantToken("tenant-1", SECRET);
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
    });

    it("embeds the tenantId in the payload", () => {
      const token = createTenantToken("my-tenant", SECRET);
      const result = verifyTenantToken(token, SECRET);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.tenantId).toBe("my-tenant");
      }
    });

    it("includes iat (issued at) timestamp", () => {
      const before = Math.floor(Date.now() / 1000);
      const token = createTenantToken("t1", SECRET);
      const after = Math.floor(Date.now() / 1000);

      const result = verifyTenantToken(token, SECRET);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.iat).toBeGreaterThanOrEqual(before);
        expect(result.payload.iat).toBeLessThanOrEqual(after);
      }
    });

    it("sets expiration when expiresInSeconds is provided", () => {
      const token = createTenantToken("t1", SECRET, 3600);
      const result = verifyTenantToken(token, SECRET);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.exp).toBeDefined();
        const iat = result.payload.iat ?? 0;
        expect(result.payload.exp).toBe(iat + 3600);
      }
    });

    it("does not set exp when expiresInSeconds is omitted", () => {
      const token = createTenantToken("t1", SECRET);
      const result = verifyTenantToken(token, SECRET);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.exp).toBeUndefined();
      }
    });
  });

  describe("verifyTenantToken", () => {
    it("rejects a token signed with a different secret", () => {
      const token = createTenantToken("t1", SECRET);
      const result = verifyTenantToken(token, "wrong-secret");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid signature");
      }
    });

    it("rejects a malformed token with fewer than 3 parts", () => {
      const result = verifyTenantToken("abc.def", SECRET);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Malformed token");
      }
    });

    it("rejects a token with tampered payload", () => {
      const token = createTenantToken("t1", SECRET);
      const parts = token.split(".");
      // Tamper with the payload
      const payload = JSON.parse(Buffer.from(parts[1] as string, "base64url").toString());
      payload.tenantId = "t2";
      const tampered = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const tamperedToken = `${parts[0]}.${tampered}.${parts[2]}`;

      const result = verifyTenantToken(tamperedToken, SECRET);
      expect(result.ok).toBe(false);
    });

    it("rejects an expired token", () => {
      // Create a token that expired 10 seconds ago
      const token = createTenantToken("t1", SECRET, -10);
      const result = verifyTenantToken(token, SECRET);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("expired");
      }
    });

    it("accepts a token that has not yet expired", () => {
      const token = createTenantToken("t1", SECRET, 3600);
      const result = verifyTenantToken(token, SECRET);
      expect(result.ok).toBe(true);
    });

    it("rejects a token with missing tenantId", async () => {
      // Manually construct a token without tenantId
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ iat: Math.floor(Date.now() / 1000) })).toString("base64url");
      const nodeCrypto = await import("node:crypto");
      const signature = nodeCrypto.createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url");
      const token = `${header}.${payload}.${signature}`;

      const result = verifyTenantToken(token, SECRET);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("tenantId");
      }
    });

    it("produces different tokens for different tenants", () => {
      const token1 = createTenantToken("tenant-a", SECRET);
      const token2 = createTenantToken("tenant-b", SECRET);
      expect(token1).not.toBe(token2);
    });
  });
});
