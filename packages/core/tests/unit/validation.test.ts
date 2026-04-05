import { describe, it, expect } from "vitest";
import {
  createChain,
  appendEntry,
} from "../../src/chain/proof-chain.js";
import {
  validateEntry,
  validateChain,
} from "../../src/chain/validation.js";
import { computeEntryHash } from "../../src/chain/hash.js";
import type { ChainState, AppendEntryInput } from "../../src/chain/proof-chain.js";
import type { ProofChainEntry } from "../../src/schema/proof-chain-entry.js";
import type { EntryType } from "../../src/schema/entry-types.js";

function makeInput(overrides: Partial<AppendEntryInput> & { entryId: string }): AppendEntryInput {
  return {
    timestamp: "2026-04-04T00:00:00.000Z",
    entryType: "ai_decision" as EntryType,
    ...overrides,
  };
}

function appendN(chain: ChainState, count: number): ChainState {
  let current = chain;
  for (let i = 0; i < count; i++) {
    const result = appendEntry(
      current,
      makeInput({ entryId: `entry-${i}` })
    );
    if (!result.ok) {
      throw new Error(`Failed to append entry ${i}: ${result.error.type}`);
    }
    current = result.value.chain;
  }
  return current;
}

function tamperEntry(
  chain: ChainState,
  index: number,
  fieldOverride: Partial<ProofChainEntry>
): ChainState {
  const entries = chain.entries.slice() as Array<ProofChainEntry>;
  entries[index] = { ...entries[index], ...fieldOverride };
  return { chainId: chain.chainId, entries };
}

describe("validateEntry", () => {
  it("returns ok for a valid genesis entry", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({ entryId: "entry-0" }));
    if (!result.ok) throw new Error("append failed");

    const validation = validateEntry(result.value.entry);
    expect(validation.ok).toBe(true);
  });

  it("returns ok for a valid entry with expected previousHash", () => {
    const chain = appendN(createChain("chain-1"), 2);
    const entry = chain.entries[1];
    const expectedPrevHash = chain.entries[0].entryHash;

    const validation = validateEntry(entry, expectedPrevHash);
    expect(validation.ok).toBe(true);
  });

  it("detects hash mismatch when entry content is tampered", () => {
    const chain = appendN(createChain("chain-1"), 1);
    const tampered = { ...chain.entries[0], annotation: "tampered" };

    const validation = validateEntry(tampered);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.error.type).toBe("HASH_MISMATCH");
    expect(validation.error.type === "HASH_MISMATCH" && validation.error.entryId).toBe("entry-0");
  });

  it("detects previousHash mismatch when expected hash does not match", () => {
    const chain = appendN(createChain("chain-1"), 2);
    const entry = chain.entries[1];

    const validation = validateEntry(entry, "wrong-hash");
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.error.type).toBe("PREVIOUS_HASH_MISMATCH");
  });

  it("validates genesis entry with null expectedPreviousHash", () => {
    const chain = appendN(createChain("chain-1"), 1);
    const entry = chain.entries[0];

    const validation = validateEntry(entry, null);
    expect(validation.ok).toBe(true);
  });

  it("fails genesis entry if expectedPreviousHash is non-null", () => {
    const chain = appendN(createChain("chain-1"), 1);
    const entry = chain.entries[0];

    const validation = validateEntry(entry, "some-hash");
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.error.type).toBe("PREVIOUS_HASH_MISMATCH");
  });
});

describe("validateChain", () => {
  it("returns ok for an empty chain", () => {
    const chain = createChain("chain-1");
    const result = validateChain(chain);
    expect(result.ok).toBe(true);
  });

  it("returns ok for a valid single-entry chain", () => {
    const chain = appendN(createChain("chain-1"), 1);
    const result = validateChain(chain);
    expect(result.ok).toBe(true);
  });

  it("returns ok for a valid 100-entry chain", () => {
    const chain = appendN(createChain("chain-1"), 100);
    const result = validateChain(chain);
    expect(result.ok).toBe(true);
  });

  it("detects tampered entry by hash mismatch at the tampered position", () => {
    const chain = appendN(createChain("chain-1"), 5);
    const tampered = tamperEntry(chain, 2, { annotation: "tampered" });

    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("HASH_MISMATCH");
    if (result.error.type !== "HASH_MISMATCH") return;
    expect(result.error.entryId).toBe("entry-2");
    expect(result.error.sequenceNumber).toBe(2);
  });

  it("detects broken previousHash linkage when an entry hash is replaced", () => {
    const chain = appendN(createChain("chain-1"), 5);
    // Tamper with entry 2's entryHash directly (not its content)
    const tampered = tamperEntry(chain, 2, { entryHash: "0000000000000000000000000000000000000000000000000000000000000000" });

    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Should detect the hash mismatch on entry 2 (content doesn't match hash)
    expect(result.error.type).toBe("HASH_MISMATCH");
    if (result.error.type !== "HASH_MISMATCH") return;
    expect(result.error.sequenceNumber).toBe(2);
  });

  it("detects chain ID mismatch", () => {
    const chain = appendN(createChain("chain-1"), 3);
    const tampered = tamperEntry(chain, 1, { chainId: "wrong-chain" });

    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("CHAIN_ID_MISMATCH");
    if (result.error.type !== "CHAIN_ID_MISMATCH") return;
    expect(result.error.entryId).toBe("entry-1");
    expect(result.error.expectedChainId).toBe("chain-1");
    expect(result.error.actualChainId).toBe("wrong-chain");
  });

  it("detects sequence number mismatch", () => {
    const chain = appendN(createChain("chain-1"), 3);
    const tampered = tamperEntry(chain, 1, { sequenceNumber: 5 });

    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("SEQUENCE_NUMBER_MISMATCH");
    if (result.error.type !== "SEQUENCE_NUMBER_MISMATCH") return;
    expect(result.error.expectedSequenceNumber).toBe(1);
    expect(result.error.actualSequenceNumber).toBe(5);
  });

  it("detects previousHash linkage break after a tampered entry", () => {
    const chain = appendN(createChain("chain-1"), 5);
    // Tamper entry 2 content and recompute its hash to make entry 2 itself valid,
    // but break the previousHash chain for entry 3
    const entry2 = chain.entries[2];
    const tamperedFields = {
      entryId: entry2.entryId,
      chainId: entry2.chainId,
      sequenceNumber: entry2.sequenceNumber,
      timestamp: entry2.timestamp,
      entryType: entry2.entryType,
      previousHash: entry2.previousHash,
      parentEntryId: entry2.parentEntryId,
      modelId: entry2.modelId,
      modelProvider: entry2.modelProvider,
      inputHash: entry2.inputHash,
      outputHash: entry2.outputHash,
      inputTokenCount: entry2.inputTokenCount,
      outputTokenCount: entry2.outputTokenCount,
      decisionType: entry2.decisionType,
      confidenceScore: entry2.confidenceScore,
      reasoningCertificateId: entry2.reasoningCertificateId,
      provenanceId: entry2.provenanceId,
      sessionId: entry2.sessionId,
      actorId: entry2.actorId,
      policyIds: entry2.policyIds,
      tags: entry2.tags,
      annotation: "tampered-content",
      complianceMetadata: entry2.complianceMetadata,
    };
    const newHash = computeEntryHash(tamperedFields);
    const tamperedChain = tamperEntry(chain, 2, {
      annotation: "tampered-content",
      entryHash: newHash,
    });

    const result = validateChain(tamperedChain);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Entry 3 should fail because its previousHash points to the old entry 2 hash
    expect(result.error.type).toBe("PREVIOUS_HASH_MISMATCH");
    if (result.error.type !== "PREVIOUS_HASH_MISMATCH") return;
    expect(result.error.sequenceNumber).toBe(3);
  });

  it("validates a chain of 10000 entries in under 500ms", () => {
    const chain = appendN(createChain("perf-chain"), 10000);

    const start = performance.now();
    const result = validateChain(chain);
    const elapsed = performance.now() - start;

    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(500);
  });

  it("reports the first error when multiple entries are tampered", () => {
    const chain = appendN(createChain("chain-1"), 5);
    let tampered = tamperEntry(chain, 1, { annotation: "tampered-1" });
    tampered = tamperEntry(tampered, 3, { annotation: "tampered-3" });

    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Should report entry 1 as the first failure
    expect(result.error.type).toBe("HASH_MISMATCH");
    if (result.error.type !== "HASH_MISMATCH") return;
    expect(result.error.sequenceNumber).toBe(1);
  });
});

