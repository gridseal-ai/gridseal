import { createHash } from "node:crypto";
import type { HashableEntryFields } from "../schema/proof-chain-entry.js";

/**
 * Ordered list of field names used for deterministic serialization.
 * This order MUST NOT change once entries exist in production chains.
 */
const HASHABLE_FIELD_ORDER: ReadonlyArray<keyof HashableEntryFields> = [
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

/**
 * Deterministically serialize a value for hashing.
 * Objects have sorted keys, arrays preserve order, primitives use JSON encoding.
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(
      (key) => JSON.stringify(key) + ":" + canonicalize(obj[key])
    );
    return "{" + pairs.join(",") + "}";
  }
  return String(value);
}

/**
 * Build the canonical string representation of an entry's hashable fields.
 * Uses a fixed field order to ensure deterministic output.
 */
export function serializeForHashing(fields: HashableEntryFields): string {
  const parts: Array<string> = [];
  for (const key of HASHABLE_FIELD_ORDER) {
    const value: unknown = fields[key];
    parts.push(JSON.stringify(key) + ":" + canonicalize(value));
  }
  return "{" + parts.join(",") + "}";
}

/** Compute SHA-256 hash of a UTF-8 string, returned as lowercase hex. */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Compute the entry hash for a set of hashable fields. */
export function computeEntryHash(fields: HashableEntryFields): string {
  return sha256(serializeForHashing(fields));
}
