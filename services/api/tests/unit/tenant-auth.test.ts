import { describe, it, expect, beforeEach } from "vitest";
import { createTenantApp } from "../../src/app.js";
import { createTenantSqliteAdapter } from "../../src/db/tenant-sqlite-adapter.js";
import { createTenantToken } from "../../src/jwt.js";
import type { Hono } from "hono";
import type { TenantSqliteHandle } from "../../src/db/tenant-sqlite-adapter.js";

const JWT_SECRET = "test-secret-for-tenant-auth";

describe("Tenant JWT authentication", () => {
  let dbHandle: TenantSqliteHandle;
  let app: Hono;

  beforeEach(() => {
    dbHandle = createTenantSqliteAdapter();
    app = createTenantApp({
      storageFactory: dbHandle.forTenant,
      jwtSecret: JWT_SECRET,
    });
  });

  it("returns 401 when no Authorization header is provided", async () => {
    const res = await app.request("/chains");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Missing API key");
  });

  it("returns 403 when an invalid JWT is provided", async () => {
    const res = await app.request("/chains", {
      headers: { Authorization: "Bearer not-a-jwt" },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Authentication failed");
  });

  it("returns 403 when JWT is signed with wrong secret", async () => {
    const token = createTenantToken("tenant-1", "wrong-secret");
    const res = await app.request("/chains", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when JWT has expired", async () => {
    const token = createTenantToken("tenant-1", JWT_SECRET, -10);
    const res = await app.request("/chains", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("expired");
  });

  it("allows access with a valid tenant JWT", async () => {
    const token = createTenantToken("tenant-1", JWT_SECRET);
    const res = await app.request("/chains", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  it("allows access with Bearer prefix", async () => {
    const token = createTenantToken("tenant-1", JWT_SECRET);
    const res = await app.request("/chains", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });
});
