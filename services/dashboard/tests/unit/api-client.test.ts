import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listChains,
  getChain,
  getChainEntries,
  getEntry,
  getEntryChildren,
  validateChain,
  validateEntry,
  getCertificate,
  verifyCertificate,
  getProvenance,
  verifyProvenance,
  checkHealth,
} from "../../src/api/client";

function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

describe("API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("listChains", () => {
    it("returns chains on success", async () => {
      const data = { chains: [{ chainId: "c1", entryCount: 5 }] };
      mockFetch(data);

      const result = await listChains();

      expect(result).toEqual({ ok: true, data });
      expect(fetch).toHaveBeenCalledWith("/api/chains/", expect.objectContaining({ headers: { "Content-Type": "application/json" } }));
    });

    it("returns error on non-ok response", async () => {
      mockFetch({ error: "Not found" }, 404);

      const result = await listChains();

      expect(result).toEqual({ ok: false, error: "Not found" });
    });

    it("returns error message on network failure", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

      const result = await listChains();

      expect(result).toEqual({ ok: false, error: "Network error" });
    });

    it("returns generic message when error body has no error field", async () => {
      mockFetch({ message: "something" }, 500);

      const result = await listChains();

      expect(result).toEqual({ ok: false, error: "Request failed with status 500" });
    });
  });

  describe("getChain", () => {
    it("fetches chain by ID", async () => {
      const data = { chainId: "c1", entryCount: 10 };
      mockFetch(data);

      const result = await getChain("c1");

      expect(result).toEqual({ ok: true, data });
      expect(fetch).toHaveBeenCalledWith("/api/chains/c1", expect.anything());
    });

    it("encodes chain ID in URL", async () => {
      mockFetch({ chainId: "a/b", entryCount: 0 });

      await getChain("a/b");

      expect(fetch).toHaveBeenCalledWith("/api/chains/a%2Fb", expect.anything());
    });
  });

  describe("getChainEntries", () => {
    it("passes offset and limit as query parameters", async () => {
      const data = { chainId: "c1", entries: [], total: 0, offset: 10, limit: 25 };
      mockFetch(data);

      await getChainEntries("c1", 10, 25);

      expect(fetch).toHaveBeenCalledWith(
        "/api/chains/c1/entries?offset=10&limit=25",
        expect.anything(),
      );
    });

    it("uses defaults for offset and limit", async () => {
      mockFetch({ chainId: "c1", entries: [], total: 0, offset: 0, limit: 100 });

      await getChainEntries("c1");

      expect(fetch).toHaveBeenCalledWith(
        "/api/chains/c1/entries?offset=0&limit=100",
        expect.anything(),
      );
    });
  });

  describe("getEntry", () => {
    it("fetches single entry", async () => {
      const entry = { entryId: "e1", chainId: "c1", sequenceNumber: 0 };
      mockFetch({ entry });

      const result = await getEntry("c1", "e1");

      expect(result).toEqual({ ok: true, data: { entry } });
      expect(fetch).toHaveBeenCalledWith("/api/chains/c1/entries/e1", expect.anything());
    });
  });

  describe("getEntryChildren", () => {
    it("fetches children of an entry", async () => {
      const data = { parentEntryId: "e1", children: [] };
      mockFetch(data);

      const result = await getEntryChildren("c1", "e1");

      expect(result).toEqual({ ok: true, data });
      expect(fetch).toHaveBeenCalledWith("/api/chains/c1/entries/e1/children", expect.anything());
    });
  });

  describe("validateChain", () => {
    it("sends POST to validate endpoint", async () => {
      const data = { valid: true, chainId: "c1", entryCount: 10 };
      mockFetch(data);

      const result = await validateChain("c1");

      expect(result).toEqual({ ok: true, data });
      expect(fetch).toHaveBeenCalledWith(
        "/api/chains/c1/validate",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("validateEntry", () => {
    it("sends POST to entry validate endpoint", async () => {
      const data = { valid: true, entryId: "e1" };
      mockFetch(data);

      const result = await validateEntry("c1", "e1");

      expect(result).toEqual({ ok: true, data });
      expect(fetch).toHaveBeenCalledWith(
        "/api/chains/c1/entries/e1/validate",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("getCertificate", () => {
    it("fetches certificate by ID", async () => {
      const certificate = { certificateId: "cert1", timestamp: "2025-01-01T00:00:00Z" };
      mockFetch({ certificate });

      const result = await getCertificate("cert1");

      expect(result).toEqual({ ok: true, data: { certificate } });
      expect(fetch).toHaveBeenCalledWith("/api/certificates/cert1", expect.anything());
    });
  });

  describe("verifyCertificate", () => {
    it("sends POST to verify certificate", async () => {
      const data = { valid: true, certificateId: "cert1" };
      mockFetch(data);

      const result = await verifyCertificate("cert1");

      expect(result).toEqual({ ok: true, data });
      expect(fetch).toHaveBeenCalledWith(
        "/api/certificates/cert1/verify",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("getProvenance", () => {
    it("fetches provenance by ID", async () => {
      const provenance = { provenanceId: "prov1" };
      mockFetch({ provenance });

      const result = await getProvenance("prov1");

      expect(result).toEqual({ ok: true, data: { provenance } });
      expect(fetch).toHaveBeenCalledWith("/api/provenance/prov1", expect.anything());
    });
  });

  describe("verifyProvenance", () => {
    it("sends POST to verify provenance", async () => {
      const data = { valid: true, provenanceId: "prov1" };
      mockFetch(data);

      const result = await verifyProvenance("prov1");

      expect(result).toEqual({ ok: true, data });
      expect(fetch).toHaveBeenCalledWith(
        "/api/provenance/prov1/verify",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("checkHealth", () => {
    it("returns health status", async () => {
      const data = { status: "ok", timestamp: "2025-01-01T00:00:00Z" };
      mockFetch(data);

      const result = await checkHealth();

      expect(result).toEqual({ ok: true, data });
      expect(fetch).toHaveBeenCalledWith("/api/health/", expect.anything());
    });
  });
});
