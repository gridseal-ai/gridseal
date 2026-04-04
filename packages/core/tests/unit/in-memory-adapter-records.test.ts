import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryAdapter } from "../../src/storage/in-memory-adapter.js";
import type { StorageAdapter } from "../../src/storage/storage-adapter.js";
import {
  createChain,
  appendEntry,
  makeInput,
  appendN,
  makeCertificate,
  makeProvenance,
} from "./storage-test-helpers.js";

let adapter: StorageAdapter;

beforeEach(() => {
  adapter = createInMemoryAdapter();
});

describe("putCertificate / getCertificate", () => {
  it("stores and retrieves a reasoning certificate by ID", async () => {
    const cert = makeCertificate("cert-1");
    const putResult = await adapter.putCertificate(cert);
    expect(putResult.ok).toBe(true);

    const getResult = await adapter.getCertificate("cert-1");
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;
    expect(getResult.value).toEqual(cert);
  });

  it("returns DUPLICATE_CERTIFICATE for an existing certificate ID", async () => {
    const cert = makeCertificate("cert-1");
    await adapter.putCertificate(cert);
    const duplicate = await adapter.putCertificate(cert);

    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.error).toEqual({
      type: "DUPLICATE_CERTIFICATE",
      certificateId: "cert-1",
    });
  });

  it("returns CERTIFICATE_NOT_FOUND for a nonexistent certificate ID", async () => {
    const result = await adapter.getCertificate("nonexistent");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      type: "CERTIFICATE_NOT_FOUND",
      certificateId: "nonexistent",
    });
  });
});

describe("putProvenance / getProvenance", () => {
  it("stores and retrieves a model provenance record by ID", async () => {
    const prov = makeProvenance("prov-1");
    const putResult = await adapter.putProvenance(prov);
    expect(putResult.ok).toBe(true);

    const getResult = await adapter.getProvenance("prov-1");
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;
    expect(getResult.value).toEqual(prov);
  });

  it("returns DUPLICATE_PROVENANCE for an existing provenance ID", async () => {
    const prov = makeProvenance("prov-1");
    await adapter.putProvenance(prov);
    const duplicate = await adapter.putProvenance(prov);

    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.error).toEqual({
      type: "DUPLICATE_PROVENANCE",
      provenanceId: "prov-1",
    });
  });

  it("returns PROVENANCE_NOT_FOUND for a nonexistent provenance ID", async () => {
    const result = await adapter.getProvenance("nonexistent");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      type: "PROVENANCE_NOT_FOUND",
      provenanceId: "nonexistent",
    });
  });
});

describe("getChainLength", () => {
  it("returns zero for a nonexistent chain", async () => {
    const length = await adapter.getChainLength("nonexistent");
    expect(length).toBe(0);
  });

  it("returns the correct count of entries in a chain", async () => {
    const chain = createChain("chain-1");
    const { entries } = appendN(chain, 7);
    for (const entry of entries) {
      await adapter.putEntry(entry);
    }

    const length = await adapter.getChainLength("chain-1");
    expect(length).toBe(7);
  });
});

describe("listChainIds", () => {
  it("returns empty array when no entries exist", async () => {
    const ids = await adapter.listChainIds();
    expect(ids).toEqual([]);
  });

  it("returns all chain IDs with stored entries", async () => {
    const chain1 = createChain("chain-a");
    const chain2 = createChain("chain-b");
    const { entries: e1 } = appendN(chain1, 1, "a");
    const { entries: e2 } = appendN(chain2, 1, "b");

    await adapter.putEntry(e1[0]);
    await adapter.putEntry(e2[0]);

    const ids = await adapter.listChainIds();
    expect(ids.sort()).toEqual(["chain-a", "chain-b"]);
  });
});

describe("clear", () => {
  it("removes all stored entries, certificates, and provenance records", async () => {
    const chain = createChain("chain-1");
    const { entries } = appendN(chain, 3);
    for (const entry of entries) {
      await adapter.putEntry(entry);
    }
    await adapter.putCertificate(makeCertificate("cert-1"));
    await adapter.putProvenance(makeProvenance("prov-1"));

    await adapter.clear();

    expect(await adapter.getEntriesByChainId("chain-1")).toEqual([]);
    expect(await adapter.getChainLength("chain-1")).toBe(0);
    expect(await adapter.listChainIds()).toEqual([]);

    const entryResult = await adapter.getEntry(entries[0].entryId);
    expect(entryResult.ok).toBe(false);

    const certResult = await adapter.getCertificate("cert-1");
    expect(certResult.ok).toBe(false);

    const provResult = await adapter.getProvenance("prov-1");
    expect(provResult.ok).toBe(false);
  });

  it("allows storing new data after clear", async () => {
    const chain = createChain("chain-1");
    const { entries } = appendN(chain, 2);
    for (const entry of entries) {
      await adapter.putEntry(entry);
    }

    await adapter.clear();

    const newChain = createChain("chain-2");
    const { entries: newEntries } = appendN(newChain, 1, "new");
    const putResult = await adapter.putEntry(newEntries[0]);
    expect(putResult.ok).toBe(true);

    const result = await adapter.getEntriesByChainId("chain-2");
    expect(result).toHaveLength(1);
  });
});

describe("concurrent operations", () => {
  it("handles concurrent puts to different chains without data loss", async () => {
    const chains = Array.from({ length: 10 }, (_, i) =>
      createChain(`chain-${i}`)
    );

    const allPuts: Array<Promise<unknown>> = [];
    for (let c = 0; c < chains.length; c++) {
      const { entries } = appendN(chains[c], 5, `c${c}`);
      for (const entry of entries) {
        allPuts.push(adapter.putEntry(entry));
      }
    }

    await Promise.all(allPuts);

    for (let c = 0; c < 10; c++) {
      const chainEntries = await adapter.getEntriesByChainId(`chain-${c}`);
      expect(chainEntries).toHaveLength(5);
    }

    const ids = await adapter.listChainIds();
    expect(ids).toHaveLength(10);
  });
});

describe("data integrity", () => {
  it("returns entries that exactly match what was stored", async () => {
    const chain = createChain("chain-1");
    const result = appendEntry(
      chain,
      makeInput({
        entryId: "integrity-test",
        modelId: "gpt-4o",
        modelProvider: "openai",
        inputHash: "abc123",
        outputHash: "def456",
        inputTokenCount: 100,
        outputTokenCount: 50,
        decisionType: "classification",
        confidenceScore: 0.95,
        sessionId: "session-1",
        actorId: "user-1",
        policyIds: ["policy-a", "policy-b"],
        tags: { env: "test", version: "1.0" },
        annotation: "test annotation",
        complianceMetadata: { framework: "colorado_ai_act" },
      })
    );
    if (!result.ok) throw new Error("append failed");
    const entry = result.value.entry;

    await adapter.putEntry(entry);
    const getResult = await adapter.getEntry("integrity-test");

    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;
    expect(getResult.value).toEqual(entry);
    expect(getResult.value.modelId).toBe("gpt-4o");
    expect(getResult.value.policyIds).toEqual(["policy-a", "policy-b"]);
    expect(getResult.value.tags).toEqual({ env: "test", version: "1.0" });
  });
});
