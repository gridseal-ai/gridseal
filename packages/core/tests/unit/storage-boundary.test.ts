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

describe("in-memory adapter boundary: large volume", () => {
  it("stores and retrieves 1000 entries without data loss", async () => {
    const chain = createChain("chain-large");
    const { entries } = appendN(chain, 1000, "vol");

    for (const entry of entries) {
      const result = await adapter.putEntry(entry);
      expect(result.ok).toBe(true);
    }

    const retrieved = await adapter.getEntriesByChainId("chain-large");
    expect(retrieved).toHaveLength(1000);

    for (let i = 0; i < 1000; i++) {
      expect(retrieved[i].entryId).toBe(`vol-${i}`);
      expect(retrieved[i].sequenceNumber).toBe(i);
      expect(retrieved[i].entryHash).toBe(entries[i].entryHash);
    }
  });

  it("stores entries with unicode fields and retrieves them exactly", async () => {
    const chain = createChain("chain-\u00fc");
    const result = appendEntry(chain, makeInput({
      entryId: "entry-\u4f60\u597d",
      annotation: "\u4f60\u597d\u4e16\u754c \ud83d\ude80",
      tags: { "\u00fc": "\u00f6", env: "test" },
      modelId: "\u00e9l\u00e8ve-model",
    }));
    if (!result.ok) throw new Error("append failed");

    await adapter.putEntry(result.value.entry);
    const getResult = await adapter.getEntry("entry-\u4f60\u597d");
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;
    expect(getResult.value.annotation).toBe("\u4f60\u597d\u4e16\u754c \ud83d\ude80");
    expect(getResult.value.tags).toEqual({ "\u00fc": "\u00f6", env: "test" });
    expect(getResult.value.modelId).toBe("\u00e9l\u00e8ve-model");
  });

  it("stores entries with long annotation (10K characters) and retrieves exactly", async () => {
    const chain = createChain("chain-1");
    const longAnnotation = "A".repeat(10_000);
    const result = appendEntry(chain, makeInput({
      entryId: "long-entry",
      annotation: longAnnotation,
    }));
    if (!result.ok) throw new Error("append failed");

    await adapter.putEntry(result.value.entry);
    const getResult = await adapter.getEntry("long-entry");
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;
    expect(getResult.value.annotation).toBe(longAnnotation);
    expect(getResult.value.annotation?.length).toBe(10_000);
  });
});

describe("in-memory adapter boundary: entry retrieval edge cases", () => {
  it("getEntriesBySequenceRange handles inverted range (start > end) gracefully", async () => {
    const chain = createChain("chain-1");
    const { entries } = appendN(chain, 5);
    for (const entry of entries) {
      await adapter.putEntry(entry);
    }

    const result = await adapter.getEntriesBySequenceRange("chain-1", 3, 1);
    expect(result).toEqual([]);
  });

  it("getEntriesBySequenceRange handles very large range beyond chain length", async () => {
    const chain = createChain("chain-1");
    const { entries } = appendN(chain, 3);
    for (const entry of entries) {
      await adapter.putEntry(entry);
    }

    const result = await adapter.getEntriesBySequenceRange("chain-1", 0, 999999);
    expect(result).toHaveLength(3);
  });

  it("getEntriesByParentId works correctly with deep tree structure", async () => {
    let chain = createChain("chain-1");
    const r0 = appendEntry(chain, makeInput({ entryId: "root" }));
    if (!r0.ok) throw new Error("append failed");
    chain = r0.value.chain;
    await adapter.putEntry(r0.value.entry);

    for (let i = 0; i < 10; i++) {
      const result = appendEntry(chain, makeInput({
        entryId: `child-${i}`,
        parentEntryId: "root",
      }));
      if (!result.ok) throw new Error("append failed");
      chain = result.value.chain;
      await adapter.putEntry(result.value.entry);
    }

    const children = await adapter.getEntriesByParentId("root");
    expect(children).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(children[i].entryId).toBe(`child-${i}`);
    }
  });
});

describe("in-memory adapter boundary: multiple chains", () => {
  it("isolates entries across 10 different chains", async () => {
    for (let c = 0; c < 10; c++) {
      const chain = createChain(`chain-${c}`);
      const { entries } = appendN(chain, 5, `c${c}-entry`);
      for (const entry of entries) {
        await adapter.putEntry(entry);
      }
    }

    for (let c = 0; c < 10; c++) {
      const entries = await adapter.getEntriesByChainId(`chain-${c}`);
      expect(entries).toHaveLength(5);
      expect(entries.every((e) => e.chainId === `chain-${c}`)).toBe(true);
    }
  });
});

describe("in-memory adapter: certificate and provenance records", () => {
  it("stores and retrieves certificates with exact data fidelity", async () => {
    const cert = makeCertificate("cert-boundary-001");
    const putResult = await adapter.putCertificate(cert);
    expect(putResult.ok).toBe(true);

    const getResult = await adapter.getCertificate("cert-boundary-001");
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;
    expect(getResult.value).toEqual(cert);
    expect(getResult.value.certificateHash).toBe(cert.certificateHash);
  });

  it("rejects duplicate certificate IDs", async () => {
    const cert = makeCertificate("cert-dup");
    await adapter.putCertificate(cert);
    const dup = await adapter.putCertificate(cert);
    expect(dup.ok).toBe(false);
    if (dup.ok) return;
    expect(dup.error.type).toBe("DUPLICATE_CERTIFICATE");
  });

  it("returns CERTIFICATE_NOT_FOUND for nonexistent ID", async () => {
    const result = await adapter.getCertificate("nonexistent");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("CERTIFICATE_NOT_FOUND");
  });

  it("stores and retrieves provenance records with exact data fidelity", async () => {
    const prov = makeProvenance("prov-boundary-001");
    const putResult = await adapter.putProvenance(prov);
    expect(putResult.ok).toBe(true);

    const getResult = await adapter.getProvenance("prov-boundary-001");
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;
    expect(getResult.value).toEqual(prov);
    expect(getResult.value.provenanceHash).toBe(prov.provenanceHash);
  });

  it("rejects duplicate provenance IDs", async () => {
    const prov = makeProvenance("prov-dup");
    await adapter.putProvenance(prov);
    const dup = await adapter.putProvenance(prov);
    expect(dup.ok).toBe(false);
    if (dup.ok) return;
    expect(dup.error.type).toBe("DUPLICATE_PROVENANCE");
  });

  it("returns PROVENANCE_NOT_FOUND for nonexistent ID", async () => {
    const result = await adapter.getProvenance("nonexistent");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("PROVENANCE_NOT_FOUND");
  });
});

describe("in-memory adapter: data round-trip integrity", () => {
  it("entry data round-trips exactly including all 24 fields", async () => {
    const chain = createChain("chain-roundtrip");
    const result = appendEntry(chain, makeInput({
      entryId: "roundtrip-entry",
      modelId: "claude-sonnet-4-20250514",
      modelProvider: "anthropic",
      inputHash: "b".repeat(64),
      outputHash: "c".repeat(64),
      inputTokenCount: 1500,
      outputTokenCount: 3000,
      decisionType: "generation",
      confidenceScore: 0.95,
      reasoningCertificateId: "cert-001",
      provenanceId: "prov-001",
      sessionId: "session-001",
      actorId: "user-42",
      policyIds: ["colorado-ai-act", "eu-ai-act"],
      tags: { env: "prod", team: "ml" },
      annotation: "Full entry roundtrip test",
      complianceMetadata: { riskLevel: "high", nested: { deep: true } },
    }));
    if (!result.ok) throw new Error("append failed");

    const entry = result.value.entry;
    await adapter.putEntry(entry);

    const retrieved = await adapter.getEntry("roundtrip-entry");
    expect(retrieved.ok).toBe(true);
    if (!retrieved.ok) return;

    expect(retrieved.value).toEqual(entry);
    expect(Object.keys(retrieved.value)).toHaveLength(24);
  });
});
