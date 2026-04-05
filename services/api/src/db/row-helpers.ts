/** Shared row conversion helpers for SQLite storage adapters. */

import type { ProofChainEntry } from "@gridseal/core";

export function entryToRow(entry: ProofChainEntry, tenantId: string) {
  return {
    entryId: entry.entryId,
    chainId: entry.chainId,
    tenantId,
    sequenceNumber: entry.sequenceNumber,
    timestamp: entry.timestamp,
    entryType: entry.entryType,
    previousHash: entry.previousHash,
    entryHash: entry.entryHash,
    parentEntryId: entry.parentEntryId,
    modelId: entry.modelId,
    modelProvider: entry.modelProvider,
    inputHash: entry.inputHash,
    outputHash: entry.outputHash,
    inputTokenCount: entry.inputTokenCount,
    outputTokenCount: entry.outputTokenCount,
    decisionType: entry.decisionType,
    confidenceScore: entry.confidenceScore,
    reasoningCertificateId: entry.reasoningCertificateId,
    provenanceId: entry.provenanceId,
    sessionId: entry.sessionId,
    actorId: entry.actorId,
    policyIds: JSON.stringify(entry.policyIds),
    tags: JSON.stringify(entry.tags),
    annotation: entry.annotation,
    complianceMetadata: JSON.stringify(entry.complianceMetadata),
  };
}

export function rowToEntry(row: Record<string, unknown>): ProofChainEntry {
  return {
    entryId: row["entryId"] as string,
    chainId: row["chainId"] as string,
    sequenceNumber: row["sequenceNumber"] as number,
    timestamp: row["timestamp"] as string,
    entryType: row["entryType"] as ProofChainEntry["entryType"],
    previousHash: (row["previousHash"] as string | null) ?? null,
    entryHash: row["entryHash"] as string,
    parentEntryId: (row["parentEntryId"] as string | null) ?? null,
    modelId: (row["modelId"] as string | null) ?? null,
    modelProvider: (row["modelProvider"] as string | null) ?? null,
    inputHash: (row["inputHash"] as string | null) ?? null,
    outputHash: (row["outputHash"] as string | null) ?? null,
    inputTokenCount: (row["inputTokenCount"] as number | null) ?? null,
    outputTokenCount: (row["outputTokenCount"] as number | null) ?? null,
    decisionType: (row["decisionType"] as ProofChainEntry["decisionType"]) ?? null,
    confidenceScore: (row["confidenceScore"] as number | null) ?? null,
    reasoningCertificateId: (row["reasoningCertificateId"] as string | null) ?? null,
    provenanceId: (row["provenanceId"] as string | null) ?? null,
    sessionId: (row["sessionId"] as string | null) ?? null,
    actorId: (row["actorId"] as string | null) ?? null,
    policyIds: JSON.parse((row["policyIds"] as string) ?? "[]") as ReadonlyArray<string>,
    tags: JSON.parse((row["tags"] as string) ?? "{}") as Readonly<Record<string, string>>,
    annotation: (row["annotation"] as string | null) ?? null,
    complianceMetadata: JSON.parse((row["complianceMetadata"] as string) ?? "{}") as Readonly<Record<string, unknown>>,
  };
}
