import { describe, expect, it } from "vitest";
import {
  canonicalize,
  computeEntryHash,
  serializeForHashing,
  sha256,
} from "../../src/chain/hash.js";
import type { HashableEntryFields } from "../../src/schema/proof-chain-entry.js";

describe("sha256", () => {
  it("produces correct hash for empty string (NIST test vector)", () => {
    // NIST FIPS 180-4 test vector: SHA-256 of empty string
    expect(sha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("produces correct hash for 'abc' (NIST test vector)", () => {
    // NIST FIPS 180-4 test vector: SHA-256 of "abc"
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("produces correct hash for longer input (NIST test vector)", () => {
    // NIST FIPS 180-4 test vector: SHA-256 of "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"
    expect(
      sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")
    ).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    );
  });

  it("returns lowercase hex string of length 64", () => {
    const hash = sha256("test input");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic across multiple calls", () => {
    const input = "deterministic test";
    expect(sha256(input)).toBe(sha256(input));
  });
});

describe("canonicalize", () => {
  it("serializes null as 'null'", () => {
    expect(canonicalize(null)).toBe("null");
  });

  it("serializes undefined as 'null'", () => {
    expect(canonicalize(undefined)).toBe("null");
  });

  it("serializes strings with JSON quoting", () => {
    expect(canonicalize("hello")).toBe('"hello"');
    expect(canonicalize('has "quotes"')).toBe('"has \\"quotes\\""');
  });

  it("serializes numbers as plain strings", () => {
    expect(canonicalize(42)).toBe("42");
    expect(canonicalize(3.14)).toBe("3.14");
    expect(canonicalize(0)).toBe("0");
    expect(canonicalize(-1)).toBe("-1");
  });

  it("serializes booleans as plain strings", () => {
    expect(canonicalize(true)).toBe("true");
    expect(canonicalize(false)).toBe("false");
  });

  it("serializes arrays preserving order", () => {
    expect(canonicalize(["a", "b"])).toBe('["a","b"]');
    expect(canonicalize([1, null, "x"])).toBe('[1,null,"x"]');
  });

  it("serializes empty arrays", () => {
    expect(canonicalize([])).toBe("[]");
  });

  it("serializes objects with sorted keys", () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    expect(canonicalize({ z: "last", a: "first" })).toBe(
      '{"a":"first","z":"last"}'
    );
  });

  it("serializes empty objects", () => {
    expect(canonicalize({})).toBe("{}");
  });

  it("serializes nested objects with sorted keys at all levels", () => {
    const input = { b: { d: 4, c: 3 }, a: [1, { f: 6, e: 5 }] };
    expect(canonicalize(input)).toBe(
      '{"a":[1,{"e":5,"f":6}],"b":{"c":3,"d":4}}'
    );
  });

  it("produces identical output regardless of key insertion order", () => {
    const obj1 = { alpha: 1, beta: 2, gamma: 3 };
    const obj2 = { gamma: 3, alpha: 1, beta: 2 };
    expect(canonicalize(obj1)).toBe(canonicalize(obj2));
  });
});

function makeHashableFields(): HashableEntryFields {
  return {
    entryId: "019505f0-0000-7000-8000-000000000001",
    chainId: "chain-001",
    sequenceNumber: 0,
    timestamp: "2026-04-04T12:00:00.000Z",
    entryType: "ai_decision",
    previousHash: null,
    parentEntryId: null,
    modelId: null,
    modelProvider: null,
    inputHash: null,
    outputHash: null,
    inputTokenCount: null,
    outputTokenCount: null,
    decisionType: null,
    confidenceScore: null,
    reasoningCertificateId: null,
    provenanceId: null,
    sessionId: null,
    actorId: null,
    policyIds: [],
    tags: {},
    annotation: null,
    complianceMetadata: {},
  };
}

describe("serializeForHashing", () => {
  it("produces a deterministic string with fields in fixed order", () => {
    const fields = makeHashableFields();
    const serialized = serializeForHashing(fields);

    // Verify it starts and ends with braces
    expect(serialized.startsWith("{")).toBe(true);
    expect(serialized.endsWith("}")).toBe(true);

    // Verify field order: entryId must come before chainId, etc.
    const entryIdPos = serialized.indexOf('"entryId"');
    const chainIdPos = serialized.indexOf('"chainId"');
    const sequencePos = serialized.indexOf('"sequenceNumber"');
    expect(entryIdPos).toBeLessThan(chainIdPos);
    expect(chainIdPos).toBeLessThan(sequencePos);
  });

  it("produces identical output for identical inputs", () => {
    const a = serializeForHashing(makeHashableFields());
    const b = serializeForHashing(makeHashableFields());
    expect(a).toBe(b);
  });

  it("includes all 23 hashable fields (24 minus entryHash)", () => {
    const serialized = serializeForHashing(makeHashableFields());
    const expectedFields = [
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
    ];
    for (const field of expectedFields) {
      expect(serialized).toContain(`"${field}":`);
    }
    expect(serialized).not.toContain('"entryHash"');
  });
});

describe("computeEntryHash", () => {
  it("returns a 64-character lowercase hex string", () => {
    const hash = computeEntryHash(makeHashableFields());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const fields = makeHashableFields();
    expect(computeEntryHash(fields)).toBe(computeEntryHash(fields));
  });

  it("produces different hashes for different inputs", () => {
    const a = makeHashableFields();
    const b = { ...a, sequenceNumber: 1 };
    expect(computeEntryHash(a)).not.toBe(computeEntryHash(b));
  });

  it("detects changes to any Tier 1 field", () => {
    const baseline = computeEntryHash(makeHashableFields());
    const fields = makeHashableFields();

    expect(computeEntryHash({ ...fields, entryId: "different" })).not.toBe(
      baseline
    );
    expect(computeEntryHash({ ...fields, chainId: "different" })).not.toBe(
      baseline
    );
    expect(computeEntryHash({ ...fields, sequenceNumber: 99 })).not.toBe(
      baseline
    );
    expect(
      computeEntryHash({ ...fields, timestamp: "2026-01-01T00:00:00Z" })
    ).not.toBe(baseline);
    expect(
      computeEntryHash({ ...fields, entryType: "human_override" })
    ).not.toBe(baseline);
    expect(
      computeEntryHash({ ...fields, previousHash: "somehash" })
    ).not.toBe(baseline);
    expect(
      computeEntryHash({ ...fields, parentEntryId: "some-parent" })
    ).not.toBe(baseline);
  });

  it("detects changes to Tier 2 fields", () => {
    const baseline = computeEntryHash(makeHashableFields());
    const fields = makeHashableFields();

    expect(computeEntryHash({ ...fields, modelId: "gpt-4o" })).not.toBe(
      baseline
    );
    expect(
      computeEntryHash({ ...fields, modelProvider: "openai" })
    ).not.toBe(baseline);
    expect(
      computeEntryHash({ ...fields, inputTokenCount: 100 })
    ).not.toBe(baseline);
    expect(
      computeEntryHash({ ...fields, confidenceScore: 0.5 })
    ).not.toBe(baseline);
  });

  it("detects changes to Tier 3 fields", () => {
    const baseline = computeEntryHash(makeHashableFields());
    const fields = makeHashableFields();

    expect(
      computeEntryHash({ ...fields, sessionId: "session-x" })
    ).not.toBe(baseline);
    expect(computeEntryHash({ ...fields, actorId: "user-1" })).not.toBe(
      baseline
    );
    expect(
      computeEntryHash({ ...fields, policyIds: ["policy-1"] })
    ).not.toBe(baseline);
    expect(
      computeEntryHash({ ...fields, tags: { key: "value" } })
    ).not.toBe(baseline);
    expect(
      computeEntryHash({ ...fields, annotation: "note" })
    ).not.toBe(baseline);
    expect(
      computeEntryHash({
        ...fields,
        complianceMetadata: { risk: "high" },
      })
    ).not.toBe(baseline);
  });
});

describe("Result type", () => {
  it("represents success with ok and value", async () => {
    const { ok, err } = await import("../../src/schema/result.js");
    const success = ok(42);
    expect(success.ok).toBe(true);
    if (success.ok) {
      expect(success.value).toBe(42);
    }
  });

  it("represents failure with ok=false and error", async () => {
    const { ok, err } = await import("../../src/schema/result.js");
    const failure = err(new Error("something broke"));
    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      expect(failure.error.message).toBe("something broke");
    }
  });
});
