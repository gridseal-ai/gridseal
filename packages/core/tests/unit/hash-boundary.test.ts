import { describe, expect, it } from "vitest";
import {
  canonicalize,
  computeEntryHash,
  serializeForHashing,
  sha256,
} from "../../src/chain/hash.js";
import type { HashableEntryFields } from "../../src/schema/proof-chain-entry.js";

function makeHashableFields(
  overrides: Partial<HashableEntryFields> = {},
): HashableEntryFields {
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
    ...overrides,
  };
}

describe("sha256 boundary inputs", () => {
  it("produces correct hash for unicode string with CJK characters", () => {
    const hash = sha256("\u4f60\u597d\u4e16\u754c");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(sha256("\u4f60\u597d\u4e16\u754c"));
  });

  it("produces correct hash for emoji input", () => {
    const hash = sha256("\ud83d\ude00\ud83d\udd25\ud83c\udf1f");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(sha256("\ud83d\ude00\ud83d\udd25\ud83c\udf1f"));
  });

  it("produces correct hash for string with null bytes", () => {
    const hash = sha256("before\0after");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(sha256("beforeafter"));
  });

  it("produces correct hash for string with newlines and carriage returns", () => {
    const hash = sha256("line1\nline2\r\nline3");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(sha256("line1line2line3"));
  });

  it("produces correct hash for very long string (100K characters)", () => {
    const longStr = "a".repeat(100_000);
    const hash = sha256(longStr);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(sha256(longStr));
  });

  it("produces different hashes for strings differing by one character", () => {
    expect(sha256("abc")).not.toBe(sha256("abd"));
  });

  it("produces different hashes for strings differing by whitespace", () => {
    expect(sha256("hello world")).not.toBe(sha256("hello  world"));
    expect(sha256("hello")).not.toBe(sha256("hello "));
    expect(sha256(" hello")).not.toBe(sha256("hello"));
  });

  it("handles string with all ASCII control characters (0x01-0x1F)", () => {
    let controlStr = "";
    for (let i = 1; i <= 31; i++) {
      controlStr += String.fromCharCode(i);
    }
    const hash = sha256(controlStr);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(sha256(controlStr));
  });

  it("produces correct hash for single-character inputs", () => {
    const hashA = sha256("a");
    const hashB = sha256("b");
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
    expect(hashB).toMatch(/^[0-9a-f]{64}$/);
    expect(hashA).not.toBe(hashB);
  });
});

describe("canonicalize boundary inputs", () => {
  it("handles NaN as a number", () => {
    const result = canonicalize(NaN);
    expect(result).toBe("NaN");
  });

  it("handles Infinity", () => {
    expect(canonicalize(Infinity)).toBe("Infinity");
  });

  it("handles -Infinity", () => {
    expect(canonicalize(-Infinity)).toBe("-Infinity");
  });

  it("handles negative zero", () => {
    expect(canonicalize(-0)).toBe("0");
  });

  it("handles deeply nested objects (10 levels)", () => {
    let obj: Record<string, unknown> = { leaf: "value" };
    for (let i = 0; i < 10; i++) {
      obj = { [`level${i}`]: obj };
    }
    const result = canonicalize(obj);
    expect(result).toContain('"leaf":"value"');
    expect(result.startsWith("{")).toBe(true);
    expect(result.endsWith("}")).toBe(true);
  });

  it("handles strings with unicode escape sequences", () => {
    expect(canonicalize("\u00e9\u00e0\u00fc")).toBe('"\u00e9\u00e0\u00fc"');
  });

  it("handles strings with backslash characters", () => {
    expect(canonicalize("path\\to\\file")).toBe('"path\\\\to\\\\file"');
  });

  it("handles empty string", () => {
    expect(canonicalize("")).toBe('""');
  });

  it("handles string containing only whitespace", () => {
    expect(canonicalize("   ")).toBe('"   "');
    // JSON.stringify escapes \t and \n
    expect(canonicalize("\t\n")).toBe('"\\t\\n"');
  });

  it("handles object with numeric-like string keys (sorted lexicographically)", () => {
    const obj = { "10": "ten", "2": "two", "1": "one" };
    const result = canonicalize(obj);
    expect(result).toBe('{"1":"one","10":"ten","2":"two"}');
  });

  it("handles object with empty string key", () => {
    const obj = { "": "empty-key" };
    expect(canonicalize(obj)).toBe('{"":"empty-key"}');
  });

  it("handles array with mixed types", () => {
    const arr = [1, "two", null, true, { a: 1 }, [3]];
    const result = canonicalize(arr);
    expect(result).toBe('[1,"two",null,true,{"a":1},[3]]');
  });

  it("is deterministic for objects with many keys regardless of insertion order", () => {
    const keys = "abcdefghijklmnopqrstuvwxyz".split("");
    const obj1: Record<string, number> = {};
    const obj2: Record<string, number> = {};

    for (let i = 0; i < keys.length; i++) {
      obj1[keys[i]] = i;
    }
    for (let i = keys.length - 1; i >= 0; i--) {
      obj2[keys[i]] = i;
    }

    expect(canonicalize(obj1)).toBe(canonicalize(obj2));
  });
});

describe("serializeForHashing boundary inputs", () => {
  it("handles entry with unicode annotation", () => {
    const fields = makeHashableFields({
      annotation: "\u4f60\u597d\u4e16\u754c \ud83d\ude80",
    });
    const serialized = serializeForHashing(fields);
    expect(serialized).toContain("\u4f60\u597d\u4e16\u754c");
    expect(serialized).toContain("\ud83d\ude80");
  });

  it("handles entry with maximum-length annotation (10K characters)", () => {
    const longAnnotation = "x".repeat(10_000);
    const fields = makeHashableFields({ annotation: longAnnotation });
    const serialized = serializeForHashing(fields);
    expect(serialized).toContain(longAnnotation);
  });

  it("handles entry with many tags (100 key-value pairs)", () => {
    const tags: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      tags[`key-${String(i).padStart(3, "0")}`] = `value-${i}`;
    }
    const fields = makeHashableFields({ tags });
    const serialized = serializeForHashing(fields);

    for (const [key, val] of Object.entries(tags)) {
      expect(serialized).toContain(`"${key}"`);
      expect(serialized).toContain(`"${val}"`);
    }
  });

  it("handles entry with many policyIds (50 items)", () => {
    const policyIds = Array.from({ length: 50 }, (_, i) => `policy-${i}`);
    const fields = makeHashableFields({ policyIds });
    const serialized = serializeForHashing(fields);

    for (const pid of policyIds) {
      expect(serialized).toContain(`"${pid}"`);
    }
  });

  it("handles entry with special characters in string fields", () => {
    const fields = makeHashableFields({
      modelId: 'model-with-"quotes"',
      modelProvider: "provider/with/slashes",
      annotation: "note with <html> & entities",
    });
    const serialized = serializeForHashing(fields);
    expect(serialized).toContain("quotes");
    expect(serialized).toContain("slashes");
    expect(serialized).toContain("<html>");
  });

  it("handles entry with deeply nested complianceMetadata", () => {
    const fields = makeHashableFields({
      complianceMetadata: {
        level1: {
          level2: {
            level3: { value: "deep" },
          },
        },
      },
    });
    const serialized = serializeForHashing(fields);
    expect(serialized).toContain('"deep"');
  });

  it("preserves field order regardless of override order", () => {
    const a = serializeForHashing(
      makeHashableFields({ modelId: "test", annotation: "note" }),
    );
    const b = serializeForHashing(
      makeHashableFields({ annotation: "note", modelId: "test" }),
    );
    expect(a).toBe(b);
  });
});

describe("computeEntryHash boundary inputs", () => {
  it("is deterministic for entries with unicode fields", () => {
    const fields = makeHashableFields({
      annotation: "\u4f60\u597d \ud83c\udf1f",
      modelId: "\u00e9l\u00e8ve-model",
      tags: { "\u00fc": "\u00f6" },
    });
    expect(computeEntryHash(fields)).toBe(computeEntryHash(fields));
  });

  it("produces different hashes for entries differing by one null vs empty string", () => {
    const a = makeHashableFields({ annotation: null });
    const b = makeHashableFields({ annotation: "" });
    expect(computeEntryHash(a)).not.toBe(computeEntryHash(b));
  });

  it("produces different hashes for entries differing by empty array vs array with empty string", () => {
    const a = makeHashableFields({ policyIds: [] });
    const b = makeHashableFields({ policyIds: [""] });
    expect(computeEntryHash(a)).not.toBe(computeEntryHash(b));
  });

  it("produces different hashes for entries differing by empty object vs object with empty key", () => {
    const a = makeHashableFields({ tags: {} });
    const b = makeHashableFields({ tags: { "": "" } });
    expect(computeEntryHash(a)).not.toBe(computeEntryHash(b));
  });

  it("produces different hashes for zero vs null in numeric fields", () => {
    const a = makeHashableFields({ inputTokenCount: null });
    const b = makeHashableFields({ inputTokenCount: 0 });
    expect(computeEntryHash(a)).not.toBe(computeEntryHash(b));
  });

  it("produces different hashes for confidenceScore 0.0 vs null", () => {
    const a = makeHashableFields({ confidenceScore: null });
    const b = makeHashableFields({ confidenceScore: 0 });
    expect(computeEntryHash(a)).not.toBe(computeEntryHash(b));
  });

  it("handles all 24 fields fully populated", () => {
    const fields = makeHashableFields({
      entryId: "019505f0-0000-7000-8000-000000000099",
      chainId: "chain-full",
      sequenceNumber: 42,
      timestamp: "2026-04-04T12:00:00.000Z",
      entryType: "ai_decision",
      previousHash: "a".repeat(64),
      parentEntryId: "parent-001",
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
      policyIds: ["colorado-ai-act", "eu-ai-act", "hipaa-164-312-b"],
      tags: { environment: "production", team: "ml-ops", version: "1.2.3" },
      annotation: "Full entry with all fields populated for testing",
      complianceMetadata: { riskLevel: "high", assessmentDate: "2026-04-01" },
    });
    const hash = computeEntryHash(fields);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(computeEntryHash(fields));
  });

  it("handles all 8 entry types", () => {
    const entryTypes = [
      "ai_decision",
      "human_override",
      "system_event",
      "policy_check",
      "data_access",
      "model_deployment",
      "feedback",
      "correction",
    ] as const;

    const hashes = new Set<string>();
    for (const entryType of entryTypes) {
      const fields = makeHashableFields({ entryType });
      const hash = computeEntryHash(fields);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      hashes.add(hash);
    }
    expect(hashes.size).toBe(8);
  });

  it("handles large sequenceNumber values", () => {
    const fields = makeHashableFields({ sequenceNumber: Number.MAX_SAFE_INTEGER });
    const hash = computeEntryHash(fields);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(
      computeEntryHash(makeHashableFields({ sequenceNumber: 0 })),
    );
  });
});
