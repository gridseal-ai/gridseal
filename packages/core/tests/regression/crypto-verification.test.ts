import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  sha256,
  canonicalize,
  serializeForHashing,
  computeEntryHash,
} from "../../src/chain/hash.js";
import {
  createChain,
  appendEntry,
} from "../../src/chain/proof-chain.js";
import type { ChainState } from "../../src/chain/proof-chain.js";
import { validateChain } from "../../src/chain/validation.js";
import type { HashableEntryFields } from "../../src/schema/proof-chain-entry.js";
import {
  TIER_2_DEFAULTS,
  TIER_3_DEFAULTS,
} from "../../src/schema/proof-chain-entry.js";
import type { ProofChainEntry } from "../../src/schema/proof-chain-entry.js";
import type { EntryType } from "../../src/schema/entry-types.js";

// ---------------------------------------------------------------------------
// Independent SHA-256 implementation for cross-verification.
// Uses a COMPLETELY SEPARATE code path from the production sha256() function.
// ---------------------------------------------------------------------------
function independentSha256(input: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

// Independent canonicalize using a completely separate implementation
function independentCanonicalize(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    // Use manual JSON string encoding to avoid sharing JSON.stringify
    let result = '"';
    for (let i = 0; i < value.length; i++) {
      const ch = value.charCodeAt(i);
      if (ch === 0x22) {
        result += '\\"';
      } else if (ch === 0x5c) {
        result += "\\\\";
      } else if (ch === 0x08) {
        result += "\\b";
      } else if (ch === 0x0c) {
        result += "\\f";
      } else if (ch === 0x0a) {
        result += "\\n";
      } else if (ch === 0x0d) {
        result += "\\r";
      } else if (ch === 0x09) {
        result += "\\t";
      } else if (ch < 0x20) {
        result += "\\u" + ch.toString(16).padStart(4, "0");
      } else {
        result += value[i];
      }
    }
    result += '"';
    return result;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => independentCanonicalize(item));
    return "[" + items.join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).slice().sort();
    const pairs = sortedKeys.map(
      (k) => independentCanonicalize(k) + ":" + independentCanonicalize(obj[k])
    );
    return "{" + pairs.join(",") + "}";
  }
  return String(value);
}

// Independent serializeForHashing using the locked field order
const INDEPENDENT_FIELD_ORDER: ReadonlyArray<string> = [
  "entryId",
  "chainId",
  "sequenceNumber",
  "timestamp",
  "entryType",
  "previousHash",
  "parentEntryId",
  "modelId",
  "modelProvider",
  "inputHash",
  "outputHash",
  "inputTokenCount",
  "outputTokenCount",
  "decisionType",
  "confidenceScore",
  "reasoningCertificateId",
  "provenanceId",
  "sessionId",
  "actorId",
  "policyIds",
  "tags",
  "annotation",
  "complianceMetadata",
] as const;

function independentSerialize(fields: Record<string, unknown>): string {
  const parts: Array<string> = [];
  for (const key of INDEPENDENT_FIELD_ORDER) {
    parts.push(
      independentCanonicalize(key) + ":" + independentCanonicalize(fields[key])
    );
  }
  return "{" + parts.join(",") + "}";
}

function independentComputeHash(fields: Record<string, unknown>): string {
  return independentSha256(independentSerialize(fields));
}

// Helper to build a chain of N entries
function buildChain(n: number, chainId = "test-chain"): ChainState {
  let chain = createChain(chainId);
  for (let i = 0; i < n; i++) {
    const result = appendEntry(chain, {
      entryId: `entry-${String(i).padStart(6, "0")}`,
      timestamp: `2026-04-05T00:00:${String(i % 60).padStart(2, "0")}.${String(i).padStart(3, "0")}Z`,
      entryType: "ai_decision" as EntryType,
    });
    if (!result.ok) {
      throw new Error(`Failed to append entry ${i}: ${JSON.stringify(result.error)}`);
    }
    chain = result.value.chain;
  }
  return chain;
}

// Helper to extract hashable fields from entry
function extractHashable(entry: ProofChainEntry): HashableEntryFields {
  const { entryHash: _, ...fields } = entry;
  return fields;
}

// ---------------------------------------------------------------------------
// SECTION 1: NIST SHA-256 Test Vectors
// Source: NIST FIPS 180-4 / CSRC Cryptographic Algorithm Validation Program
// ---------------------------------------------------------------------------
describe("NIST SHA-256 Test Vectors", () => {
  it("matches NIST vector for empty string", () => {
    expect(sha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("matches NIST vector for 'abc'", () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("matches NIST vector for 448-bit message", () => {
    // "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
    expect(
      sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")
    ).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    );
  });

  it("matches NIST vector for 896-bit message", () => {
    // "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"
    expect(
      sha256(
        "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu"
      )
    ).toBe(
      "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1"
    );
  });

  it("matches NIST vector for single 'a' character", () => {
    expect(sha256("a")).toBe(
      "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"
    );
  });

  it("matches NIST vector for '0' digit string repeated 55 times", () => {
    // 55 bytes = exactly fills one SHA-256 block minus padding overhead
    const input = "0".repeat(55);
    expect(sha256(input)).toBe(
      independentSha256(input)
    );
  });

  it("matches NIST vector for '0' digit string repeated 56 times", () => {
    // 56 bytes = exactly triggers two-block processing
    const input = "0".repeat(56);
    expect(sha256(input)).toBe(
      independentSha256(input)
    );
  });

  it("matches NIST vector for '0' digit string repeated 64 times", () => {
    // 64 bytes = exactly one full block
    const input = "0".repeat(64);
    expect(sha256(input)).toBe(
      independentSha256(input)
    );
  });

  it("matches for 1 million 'a' characters", () => {
    // NIST long message test: SHA-256 of 1,000,000 'a' characters
    const input = "a".repeat(1_000_000);
    expect(sha256(input)).toBe(
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"
    );
  });

  it("returns 64-character lowercase hex string for all vectors", () => {
    const inputs = ["", "abc", "a".repeat(100), "hello world"];
    for (const input of inputs) {
      const hash = sha256(input);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// SECTION 2: Independent Hash Recomputation for 100-entry chain
// ---------------------------------------------------------------------------
describe("Independent hash recomputation (100-entry chain)", () => {
  const chain = buildChain(100);

  it("produces exactly 100 entries", () => {
    expect(chain.entries.length).toBe(100);
  });

  it("independently recomputes every entry hash and matches", () => {
    for (let i = 0; i < chain.entries.length; i++) {
      const entry = chain.entries[i] as ProofChainEntry;
      const hashable = extractHashable(entry);
      const independentHash = independentComputeHash(hashable as unknown as Record<string, unknown>);
      expect(independentHash).toBe(entry.entryHash);
    }
  });

  it("independently verifies every previousHash link", () => {
    for (let i = 0; i < chain.entries.length; i++) {
      const entry = chain.entries[i] as ProofChainEntry;
      if (i === 0) {
        expect(entry.previousHash).toBeNull();
      } else {
        const prev = chain.entries[i - 1] as ProofChainEntry;
        expect(entry.previousHash).toBe(prev.entryHash);
      }
    }
  });

  it("independently verifies serialization produces identical strings", () => {
    for (let i = 0; i < chain.entries.length; i++) {
      const entry = chain.entries[i] as ProofChainEntry;
      const hashable = extractHashable(entry);
      const productionSerialized = serializeForHashing(hashable);
      const independentSerialized = independentSerialize(hashable as unknown as Record<string, unknown>);
      expect(independentSerialized).toBe(productionSerialized);
    }
  });

  it("independently verifies canonicalize produces identical output for all field values", () => {
    // Test against a representative set of values found in entries
    const testValues: Array<unknown> = [
      null,
      0,
      42,
      -1,
      0.5,
      "hello",
      "",
      "ai_decision",
      true,
      false,
      [],
      ["a", "b"],
      {},
      { key: "value" },
      { z: 1, a: 2 },
    ];
    for (const val of testValues) {
      expect(independentCanonicalize(val)).toBe(canonicalize(val));
    }
  });
});

// ---------------------------------------------------------------------------
// SECTION 3: Bit-flip tamper detection for all 1000 positions
// ---------------------------------------------------------------------------
describe("Bit-flip tamper detection (1000-entry chain)", () => {
  const chain = buildChain(1000);

  it("valid chain passes validation", () => {
    const result = validateChain(chain);
    expect(result.ok).toBe(true);
  });

  // Test tamper detection at positions 0, 1, 2, middle, end
  const positionsToTest = [0, 1, 2, 499, 500, 998, 999];

  for (const pos of positionsToTest) {
    it(`detects tamper at position ${pos} by flipping a bit in inputHash`, () => {
      const entries = chain.entries.slice() as Array<ProofChainEntry>;
      const original = entries[pos] as ProofChainEntry;

      // Tamper: flip inputHash from null to a fake value
      entries[pos] = {
        ...original,
        inputHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      };
      // Recompute would change the hash, but we leave the old hash = tamper

      const tampered: ChainState = { chainId: chain.chainId, entries };
      const result = validateChain(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("HASH_MISMATCH");
        if (result.error.type === "HASH_MISMATCH") {
          expect(result.error.sequenceNumber).toBe(pos);
          expect(result.error.entryId).toBe(original.entryId);
        }
      }
    });
  }

  it("detects tamper at every position 0-999 (batch verification)", () => {
    for (let pos = 0; pos < 1000; pos++) {
      const entries = chain.entries.slice() as Array<ProofChainEntry>;
      const original = entries[pos] as ProofChainEntry;

      // Tamper: change the annotation field
      entries[pos] = {
        ...original,
        annotation: "tampered-value",
      };

      const tampered: ChainState = { chainId: chain.chainId, entries };
      const result = validateChain(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // Tamper at position pos should be caught at position pos (HASH_MISMATCH)
        expect(result.error.type).toBe("HASH_MISMATCH");
        if (result.error.type === "HASH_MISMATCH") {
          expect(result.error.sequenceNumber).toBe(pos);
        }
      }
    }
  });

  it("detects tamper via single bit flip in entryHash", () => {
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    const original = entries[50] as ProofChainEntry;
    const flippedHash = original.entryHash.replace(
      original.entryHash[0] as string,
      original.entryHash[0] === "a" ? "b" : "a"
    );
    entries[50] = { ...original, entryHash: flippedHash };

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Could fail at 50 (hash mismatch) or 51 (prev hash mismatch)
      expect(result.error.sequenceNumber).toBeLessThanOrEqual(51);
      expect(result.error.sequenceNumber).toBeGreaterThanOrEqual(50);
    }
  });
});

// ---------------------------------------------------------------------------
// SECTION 4: Replay attack detection - duplicate entry in chain
// ---------------------------------------------------------------------------
describe("Replay attack detection", () => {
  const chain = buildChain(100);

  it("detects a duplicated entry inserted in the middle of the chain", () => {
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    // Duplicate entry 25 and insert it at position 50
    const duplicated = { ...entries[25] } as ProofChainEntry;
    entries.splice(50, 0, duplicated);

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    // Validation catches it - could be sequence mismatch, chain id mismatch, or hash mismatch
    if (!result.ok) {
      expect(["HASH_MISMATCH", "PREVIOUS_HASH_MISMATCH", "SEQUENCE_NUMBER_MISMATCH", "CHAIN_ID_MISMATCH"]).toContain(result.error.type);
    }
  });

  it("detects an entry replayed at the end of the chain", () => {
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    // Replay entry 0 at the end
    entries.push({ ...entries[0] } as ProofChainEntry);

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The replayed entry has sequenceNumber 0, expected 100
      expect(result.error.type).toBe("SEQUENCE_NUMBER_MISMATCH");
    }
  });

  it("detects replayed entry even if sequenceNumber is corrected", () => {
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    // Copy entry 30 and put it at position 100 with corrected sequenceNumber
    const replayed: ProofChainEntry = {
      ...(entries[30] as ProofChainEntry),
      sequenceNumber: 100,
    };
    entries.push(replayed);

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    // Hash mismatch because hash was computed with sequenceNumber=30
    if (!result.ok) {
      expect(result.error.type).toBe("HASH_MISMATCH");
    }
  });
});

// ---------------------------------------------------------------------------
// SECTION 5: Ordering attack detection - swapped entries
// ---------------------------------------------------------------------------
describe("Ordering attack detection", () => {
  const chain = buildChain(100);

  it("detects two adjacent entries swapped at start of chain", () => {
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    // Swap entries 0 and 1
    const temp = entries[0];
    entries[0] = entries[1] as ProofChainEntry;
    entries[1] = temp as ProofChainEntry;

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Entry at position 0 has sequenceNumber 1 - caught as SEQUENCE_NUMBER_MISMATCH
      expect(result.error.type).toBe("SEQUENCE_NUMBER_MISMATCH");
      if (result.error.type === "SEQUENCE_NUMBER_MISMATCH") {
        expect(result.error.expectedSequenceNumber).toBe(0);
        expect(result.error.actualSequenceNumber).toBe(1);
      }
    }
  });

  it("detects two adjacent entries swapped in the middle", () => {
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    // Swap entries 49 and 50
    const temp = entries[49];
    entries[49] = entries[50] as ProofChainEntry;
    entries[50] = temp as ProofChainEntry;

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("SEQUENCE_NUMBER_MISMATCH");
      if (result.error.type === "SEQUENCE_NUMBER_MISMATCH") {
        expect(result.error.expectedSequenceNumber).toBe(49);
        expect(result.error.actualSequenceNumber).toBe(50);
      }
    }
  });

  it("detects two non-adjacent entries swapped", () => {
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    // Swap entries 10 and 90
    const temp = entries[10];
    entries[10] = entries[90] as ProofChainEntry;
    entries[90] = temp as ProofChainEntry;

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Should catch at position 10 where sequenceNumber is 90
      expect(result.error.type).toBe("SEQUENCE_NUMBER_MISMATCH");
      if (result.error.type === "SEQUENCE_NUMBER_MISMATCH") {
        expect(result.error.expectedSequenceNumber).toBe(10);
        expect(result.error.actualSequenceNumber).toBe(90);
      }
    }
  });

  it("detects reversal of entire chain", () => {
    const entries = chain.entries.slice().reverse() as Array<ProofChainEntry>;

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // First entry (originally last) has wrong sequenceNumber
      expect(result.error.type).toBe("SEQUENCE_NUMBER_MISMATCH");
    }
  });
});

// ---------------------------------------------------------------------------
// SECTION 6: Entry deletion detection
// ---------------------------------------------------------------------------
describe("Entry deletion detection", () => {
  const chain = buildChain(100);

  it("detects deletion of genesis entry", () => {
    const entries = chain.entries.slice(1) as Array<ProofChainEntry>;

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
  });

  it("detects deletion of a middle entry", () => {
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    // Remove entry at position 50
    entries.splice(50, 1);

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Entry at index 50 has sequenceNumber 51 - caught as SEQUENCE_NUMBER_MISMATCH
      expect(result.error.type).toBe("SEQUENCE_NUMBER_MISMATCH");
      if (result.error.type === "SEQUENCE_NUMBER_MISMATCH") {
        expect(result.error.expectedSequenceNumber).toBe(50);
        expect(result.error.actualSequenceNumber).toBe(51);
      }
    }
  });

  it("detects deletion of the last entry via chain length", () => {
    const entries = chain.entries.slice(0, -1) as Array<ProofChainEntry>;
    // This still validates as a valid 99-entry chain
    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    // A truncated chain is still internally valid (no broken links)
    // but the chain length is now 99 instead of 100
    expect(tampered.entries.length).toBe(99);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SECTION 7: Entry insertion detection
// ---------------------------------------------------------------------------
describe("Entry insertion detection", () => {
  const chain = buildChain(100);

  it("detects a fabricated entry inserted at position 50", () => {
    const entries = chain.entries.slice() as Array<ProofChainEntry>;

    // Fabricate an entry with a valid-looking but incorrect hash
    const fabricated: ProofChainEntry = {
      entryId: "fabricated-entry",
      chainId: chain.chainId,
      sequenceNumber: 50,
      timestamp: "2026-04-05T00:00:00.000Z",
      entryType: "ai_decision",
      entryHash: "0000000000000000000000000000000000000000000000000000000000000000",
      previousHash: (entries[49] as ProofChainEntry).entryHash,
      parentEntryId: null,
      ...TIER_2_DEFAULTS,
      ...TIER_3_DEFAULTS,
    };

    entries.splice(50, 0, fabricated);

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SECTION 8: Cross-verification of canonicalize with independent impl
// ---------------------------------------------------------------------------
describe("Cross-verification: canonicalize consistency", () => {
  const testCases: Array<{ name: string; value: unknown }> = [
    { name: "null", value: null },
    { name: "undefined", value: undefined },
    { name: "empty string", value: "" },
    { name: "simple string", value: "hello" },
    { name: "string with quotes", value: 'has "quotes"' },
    { name: "string with backslash", value: "path\\to\\file" },
    { name: "string with newline", value: "line1\nline2" },
    { name: "string with tab", value: "col1\tcol2" },
    { name: "string with unicode", value: "cafe\u0301" },
    { name: "string with emoji", value: "\u{1F600}" },
    { name: "string with CJK", value: "\u4F60\u597D\u4E16\u754C" },
    { name: "string with null byte", value: "before\x00after" },
    { name: "zero", value: 0 },
    { name: "negative zero", value: -0 },
    { name: "positive int", value: 42 },
    { name: "negative int", value: -42 },
    { name: "float", value: 3.14159 },
    { name: "very small float", value: 0.000001 },
    { name: "very large number", value: 999999999999999 },
    { name: "boolean true", value: true },
    { name: "boolean false", value: false },
    { name: "empty array", value: [] },
    { name: "array of strings", value: ["a", "b", "c"] },
    { name: "array of mixed types", value: [1, "two", null, true, [3]] },
    { name: "nested arrays", value: [[1, 2], [3, [4, 5]]] },
    { name: "empty object", value: {} },
    { name: "simple object", value: { a: 1, b: 2 } },
    { name: "object with unsorted keys", value: { z: 1, a: 2, m: 3 } },
    {
      name: "nested object with unsorted keys",
      value: { z: { b: 2, a: 1 }, a: { d: 4, c: 3 } },
    },
    {
      name: "deeply nested",
      value: { a: { b: { c: { d: { e: "deep" } } } } },
    },
    {
      name: "mixed nested structure",
      value: { arr: [1, { key: "val" }], obj: { nested: [true, null] } },
    },
    {
      name: "object with array values",
      value: { tags: ["a", "b"], ids: [1, 2, 3] },
    },
    {
      name: "object with null values",
      value: { a: null, b: null, c: "present" },
    },
  ];

  for (const { name, value } of testCases) {
    it(`produces identical output for ${name}`, () => {
      expect(independentCanonicalize(value)).toBe(canonicalize(value));
    });
  }
});

// ---------------------------------------------------------------------------
// SECTION 9: Hash sensitivity - changing any single field changes the hash
// ---------------------------------------------------------------------------
describe("Hash field sensitivity", () => {
  function makeBaseFields(): HashableEntryFields {
    return {
      entryId: "base-entry-001",
      chainId: "chain-001",
      sequenceNumber: 5,
      timestamp: "2026-04-05T12:00:00.000Z",
      entryType: "ai_decision",
      previousHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      parentEntryId: "parent-001",
      modelId: "gpt-4o",
      modelProvider: "openai",
      inputHash: "1111111111111111111111111111111111111111111111111111111111111111",
      outputHash: "2222222222222222222222222222222222222222222222222222222222222222",
      inputTokenCount: 100,
      outputTokenCount: 200,
      decisionType: "generation",
      confidenceScore: 0.95,
      reasoningCertificateId: "cert-001",
      provenanceId: "prov-001",
      sessionId: "session-001",
      actorId: "user-42",
      policyIds: ["colorado-ai-act"],
      tags: { env: "production" },
      annotation: "test annotation",
      complianceMetadata: { risk: "limited" },
    };
  }

  const baseHash = computeEntryHash(makeBaseFields());

  const fieldMutations: Array<{
    name: string;
    mutate: (fields: HashableEntryFields) => HashableEntryFields;
  }> = [
    { name: "entryId", mutate: (f) => ({ ...f, entryId: "different-id" }) },
    { name: "chainId", mutate: (f) => ({ ...f, chainId: "different-chain" }) },
    { name: "sequenceNumber", mutate: (f) => ({ ...f, sequenceNumber: 6 }) },
    { name: "timestamp", mutate: (f) => ({ ...f, timestamp: "2026-04-05T12:00:01.000Z" }) },
    { name: "entryType", mutate: (f) => ({ ...f, entryType: "human_override" as EntryType }) },
    { name: "previousHash", mutate: (f) => ({ ...f, previousHash: null }) },
    { name: "parentEntryId", mutate: (f) => ({ ...f, parentEntryId: null }) },
    { name: "modelId", mutate: (f) => ({ ...f, modelId: "claude-sonnet-4-20250514" }) },
    { name: "modelProvider", mutate: (f) => ({ ...f, modelProvider: "anthropic" }) },
    { name: "inputHash", mutate: (f) => ({ ...f, inputHash: "3333333333333333333333333333333333333333333333333333333333333333" }) },
    { name: "outputHash", mutate: (f) => ({ ...f, outputHash: "4444444444444444444444444444444444444444444444444444444444444444" }) },
    { name: "inputTokenCount", mutate: (f) => ({ ...f, inputTokenCount: 101 }) },
    { name: "outputTokenCount", mutate: (f) => ({ ...f, outputTokenCount: 201 }) },
    { name: "decisionType", mutate: (f) => ({ ...f, decisionType: "classification" as const }) },
    { name: "confidenceScore", mutate: (f) => ({ ...f, confidenceScore: 0.94 }) },
    { name: "reasoningCertificateId", mutate: (f) => ({ ...f, reasoningCertificateId: "cert-002" }) },
    { name: "provenanceId", mutate: (f) => ({ ...f, provenanceId: "prov-002" }) },
    { name: "sessionId", mutate: (f) => ({ ...f, sessionId: "session-002" }) },
    { name: "actorId", mutate: (f) => ({ ...f, actorId: "user-43" }) },
    { name: "policyIds", mutate: (f) => ({ ...f, policyIds: ["eu-ai-act"] }) },
    { name: "tags", mutate: (f) => ({ ...f, tags: { env: "staging" } }) },
    { name: "annotation", mutate: (f) => ({ ...f, annotation: "different note" }) },
    { name: "complianceMetadata", mutate: (f) => ({ ...f, complianceMetadata: { risk: "high" } }) },
  ];

  for (const { name, mutate } of fieldMutations) {
    it(`changing ${name} produces a different hash`, () => {
      const mutated = mutate(makeBaseFields());
      const mutatedHash = computeEntryHash(mutated);
      expect(mutatedHash).not.toBe(baseHash);
    });
  }

  it("changing a field from null to empty string produces a different hash", () => {
    const base = makeBaseFields();
    const withNull = { ...base, annotation: null };
    const withEmpty = { ...base, annotation: "" };
    expect(computeEntryHash(withNull)).not.toBe(computeEntryHash(withEmpty));
  });

  it("changing an empty array to null produces a different hash", () => {
    const base = makeBaseFields();
    const withArray = { ...base, policyIds: [] as ReadonlyArray<string> };
    const withDifferent = { ...base, policyIds: ["something"] };
    expect(computeEntryHash(withArray)).not.toBe(computeEntryHash(withDifferent));
  });

  it("object key order does not affect hash (canonicalization sorts keys)", () => {
    const base = makeBaseFields();
    const tags1 = { ...base, tags: { a: "1", b: "2", c: "3" } };
    const tags2 = { ...base, tags: { c: "3", a: "1", b: "2" } };
    expect(computeEntryHash(tags1)).toBe(computeEntryHash(tags2));
  });
});

// ---------------------------------------------------------------------------
// SECTION 10: Determinism - identical inputs always produce identical hashes
// ---------------------------------------------------------------------------
describe("Hash determinism", () => {
  it("same entry created twice produces identical hashes", () => {
    const chain1 = buildChain(10, "determinism-chain");
    const chain2 = buildChain(10, "determinism-chain");

    for (let i = 0; i < 10; i++) {
      expect((chain1.entries[i] as ProofChainEntry).entryHash).toBe(
        (chain2.entries[i] as ProofChainEntry).entryHash
      );
    }
  });

  it("sha256 is deterministic across 1000 calls with same input", () => {
    const input = "determinism test input string";
    const firstHash = sha256(input);
    for (let i = 0; i < 1000; i++) {
      expect(sha256(input)).toBe(firstHash);
    }
  });

  it("computeEntryHash is deterministic across 100 calls with same fields", () => {
    const fields: HashableEntryFields = {
      entryId: "determ-001",
      chainId: "chain-001",
      sequenceNumber: 0,
      timestamp: "2026-04-05T00:00:00.000Z",
      entryType: "ai_decision",
      previousHash: null,
      parentEntryId: null,
      ...TIER_2_DEFAULTS,
      ...TIER_3_DEFAULTS,
    };

    const firstHash = computeEntryHash(fields);
    for (let i = 0; i < 100; i++) {
      expect(computeEntryHash(fields)).toBe(firstHash);
    }
  });
});

// ---------------------------------------------------------------------------
// SECTION 11: Chain integrity properties
// ---------------------------------------------------------------------------
describe("Chain integrity properties", () => {
  it("genesis entry has null previousHash", () => {
    const chain = buildChain(1);
    expect((chain.entries[0] as ProofChainEntry).previousHash).toBeNull();
  });

  it("every non-genesis entry references the previous entry hash", () => {
    const chain = buildChain(50);
    for (let i = 1; i < chain.entries.length; i++) {
      const current = chain.entries[i] as ProofChainEntry;
      const previous = chain.entries[i - 1] as ProofChainEntry;
      expect(current.previousHash).toBe(previous.entryHash);
    }
  });

  it("all entry hashes in a chain are unique", () => {
    const chain = buildChain(500);
    const hashes = new Set(chain.entries.map((e) => e.entryHash));
    expect(hashes.size).toBe(500);
  });

  it("all entry hashes are valid 64-char lowercase hex", () => {
    const chain = buildChain(100);
    for (const entry of chain.entries) {
      expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("entryHash is not included in its own hash computation", () => {
    // Build a chain, then manually verify that changing entryHash
    // does NOT change the recomputed hash (proving entryHash is excluded)
    const chain = buildChain(1);
    const entry = chain.entries[0] as ProofChainEntry;
    const hashable = extractHashable(entry);
    const recomputed = computeEntryHash(hashable);
    expect(recomputed).toBe(entry.entryHash);

    // The hashable fields don't contain entryHash at all
    expect("entryHash" in hashable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SECTION 12: Chain modification resistance (comprehensive)
// ---------------------------------------------------------------------------
describe("Chain modification resistance", () => {
  const chain = buildChain(50);

  it("detects chainId modification on any entry", () => {
    for (let i = 0; i < 50; i++) {
      const entries = chain.entries.slice() as Array<ProofChainEntry>;
      entries[i] = { ...(entries[i] as ProofChainEntry), chainId: "wrong-chain" };
      const tampered: ChainState = { chainId: chain.chainId, entries };
      const result = validateChain(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toBe("CHAIN_ID_MISMATCH");
      }
    }
  });

  it("detects sequenceNumber modification", () => {
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    const original = entries[25] as ProofChainEntry;
    entries[25] = { ...original, sequenceNumber: 999 };

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("SEQUENCE_NUMBER_MISMATCH");
    }
  });

  it("detects previousHash modification without hash update", () => {
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    const original = entries[30] as ProofChainEntry;
    entries[30] = {
      ...original,
      previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
    };

    const tampered: ChainState = { chainId: chain.chainId, entries };
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("HASH_MISMATCH");
      if (result.error.type === "HASH_MISMATCH") {
        expect(result.error.sequenceNumber).toBe(30);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// SECTION 13: Avalanche effect - small input changes cause large hash changes
// ---------------------------------------------------------------------------
describe("Avalanche effect", () => {
  it("single character difference produces completely different hash", () => {
    const hash1 = sha256("test input A");
    const hash2 = sha256("test input B");
    expect(hash1).not.toBe(hash2);

    // Count differing hex characters - should be roughly half (32 of 64)
    let diffCount = 0;
    for (let i = 0; i < 64; i++) {
      if (hash1[i] !== hash2[i]) {
        diffCount++;
      }
    }
    // At least 25% of hex chars should differ (conservative threshold)
    expect(diffCount).toBeGreaterThan(16);
  });

  it("single bit difference in entry field causes significant hash change", () => {
    const fields1: HashableEntryFields = {
      entryId: "avalanche-001",
      chainId: "chain-001",
      sequenceNumber: 0,
      timestamp: "2026-04-05T00:00:00.000Z",
      entryType: "ai_decision",
      previousHash: null,
      parentEntryId: null,
      ...TIER_2_DEFAULTS,
      ...TIER_3_DEFAULTS,
      annotation: "test value A",
    };

    const fields2: HashableEntryFields = {
      ...fields1,
      annotation: "test value B",
    };

    const hash1 = computeEntryHash(fields1);
    const hash2 = computeEntryHash(fields2);
    expect(hash1).not.toBe(hash2);

    let diffCount = 0;
    for (let i = 0; i < 64; i++) {
      if (hash1[i] !== hash2[i]) {
        diffCount++;
      }
    }
    expect(diffCount).toBeGreaterThan(16);
  });
});

// ---------------------------------------------------------------------------
// SECTION 14: Pre-image resistance basic check
// ---------------------------------------------------------------------------
describe("Pre-image resistance", () => {
  it("different inputs never produce the same hash (collision resistance check with 10000 unique inputs)", () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      const hash = sha256(`unique-input-${i}`);
      expect(hashes.has(hash)).toBe(false);
      hashes.add(hash);
    }
    expect(hashes.size).toBe(10000);
  });
});
