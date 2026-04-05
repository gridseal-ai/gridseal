import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listChains,
  getChain,
  getChainEntries,
  getEntry,
  validateChain,
  validateEntry,
  getCertificate,
  verifyCertificate,
  getProvenance,
  verifyProvenance,
} from "../../src/api/client.ts";

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("API Client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("listChains", () => {
    it("returns chains on success", async () => {
      const data = { chains: [{ chainId: "c1", entryCount: 5 }] };
      globalThis.fetch = mockFetch(data);

      const result = await listChains("/test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.chains).toHaveLength(1);
        expect(result.value.chains[0]?.chainId).toBe("c1");
      }
    });

    it("returns error on HTTP failure", async () => {
      globalThis.fetch = mockFetch({ error: "not found" }, 404);

      const result = await listChains("/test");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("not found");
      }
    });

    it("returns error on network failure", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down"));

      const result = await listChains("/test");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("network down");
      }
    });
  });

  describe("getChain", () => {
    it("returns chain metadata on success", async () => {
      const data = { chainId: "c1", entryCount: 10 };
      globalThis.fetch = mockFetch(data);

      const result = await getChain("c1", "/test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.entryCount).toBe(10);
      }
    });
  });

  describe("getChainEntries", () => {
    it("passes offset and limit as query parameters", async () => {
      const data = {
        chainId: "c1",
        entries: [],
        total: 0,
        offset: 20,
        limit: 10,
      };
      globalThis.fetch = mockFetch(data);

      await getChainEntries("c1", 20, 10, "/test");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("offset=20"),
        expect.any(Object),
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=10"),
        expect.any(Object),
      );
    });

    it("returns paginated entries on success", async () => {
      const data = {
        chainId: "c1",
        entries: [{ entryId: "e1", sequenceNumber: 0 }],
        total: 1,
        offset: 0,
        limit: 100,
      };
      globalThis.fetch = mockFetch(data);

      const result = await getChainEntries("c1", 0, 100, "/test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.total).toBe(1);
        expect(result.value.entries).toHaveLength(1);
      }
    });
  });

  describe("getEntry", () => {
    it("returns a single entry on success", async () => {
      const data = { entry: { entryId: "e1", chainId: "c1" } };
      globalThis.fetch = mockFetch(data);

      const result = await getEntry("c1", "e1", "/test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.entry.entryId).toBe("e1");
      }
    });
  });

  describe("validateChain", () => {
    it("posts to validate endpoint and returns result", async () => {
      const data = { valid: true, chainId: "c1", entryCount: 5 };
      globalThis.fetch = mockFetch(data);

      const result = await validateChain("c1", "/test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.valid).toBe(true);
      }
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/test/chains/c1/validate",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns validation failure details", async () => {
      const data = {
        valid: false,
        chainId: "c1",
        entryCount: 5,
        error: { type: "hash_mismatch" },
      };
      globalThis.fetch = mockFetch(data);

      const result = await validateChain("c1", "/test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.valid).toBe(false);
        expect(result.value.error).toBeDefined();
      }
    });
  });

  describe("validateEntry", () => {
    it("validates a single entry hash", async () => {
      const data = { valid: true, entryId: "e1" };
      globalThis.fetch = mockFetch(data);

      const result = await validateEntry("c1", "e1", "/test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.valid).toBe(true);
        expect(result.value.entryId).toBe("e1");
      }
    });
  });

  describe("getCertificate", () => {
    it("returns a reasoning certificate", async () => {
      const data = {
        certificate: {
          certificateId: "cert1",
          modelId: "gpt-4o",
          certificateHash: "abc123",
        },
      };
      globalThis.fetch = mockFetch(data);

      const result = await getCertificate("cert1", "/test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.certificate.certificateId).toBe("cert1");
      }
    });
  });

  describe("verifyCertificate", () => {
    it("verifies certificate integrity", async () => {
      const data = { valid: true, certificateId: "cert1" };
      globalThis.fetch = mockFetch(data);

      const result = await verifyCertificate("cert1", "/test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.valid).toBe(true);
      }
    });
  });

  describe("getProvenance", () => {
    it("returns a model provenance record", async () => {
      const data = {
        provenance: {
          provenanceId: "prov1",
          modelName: "gpt-4o",
          provenanceHash: "def456",
        },
      };
      globalThis.fetch = mockFetch(data);

      const result = await getProvenance("prov1", "/test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.provenance.provenanceId).toBe("prov1");
      }
    });
  });

  describe("verifyProvenance", () => {
    it("verifies provenance record integrity", async () => {
      const data = { valid: true, provenanceId: "prov1" };
      globalThis.fetch = mockFetch(data);

      const result = await verifyProvenance("prov1", "/test");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.valid).toBe(true);
      }
    });
  });

  describe("URL encoding", () => {
    it("encodes chain IDs with special characters", async () => {
      globalThis.fetch = mockFetch({ chainId: "a/b", entryCount: 0 });

      await getChain("a/b", "/test");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/test/chains/a%2Fb",
        expect.any(Object),
      );
    });
  });
});
