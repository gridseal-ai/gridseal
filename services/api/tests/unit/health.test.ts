import { describe, it, expect } from "vitest";
import { createInMemoryAdapter } from "@gridseal/core";
import { createApp } from "../../src/app.js";

function makeApp() {
  return createApp({ storage: createInMemoryAdapter() });
}

describe("Health routes", () => {
  it("returns ok status and a timestamp", async () => {
    const app = makeApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe("ok");
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns 404 for unknown routes", async () => {
    const app = makeApp();
    const res = await app.request("/nonexistent");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Not found");
  });
});
