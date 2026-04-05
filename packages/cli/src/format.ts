import type { ProofChainEntry } from "@gridseal/core";
import type { ValidationError } from "@gridseal/core";

/** Format a validation error into a human-readable string. */
export function formatValidationError(error: ValidationError): string {
  switch (error.type) {
    case "HASH_MISMATCH":
      return [
        `HASH_MISMATCH at entry ${error.entryId} (seq ${error.sequenceNumber})`,
        `  expected: ${error.expectedHash}`,
        `  actual:   ${error.actualHash}`,
      ].join("\n");
    case "PREVIOUS_HASH_MISMATCH":
      return [
        `PREVIOUS_HASH_MISMATCH at entry ${error.entryId} (seq ${error.sequenceNumber})`,
        `  expected previousHash: ${error.expectedPreviousHash ?? "(null)"}`,
        `  actual previousHash:   ${error.actualPreviousHash ?? "(null)"}`,
      ].join("\n");
    case "SEQUENCE_NUMBER_MISMATCH":
      return [
        `SEQUENCE_NUMBER_MISMATCH at entry ${error.entryId}`,
        `  expected: ${error.expectedSequenceNumber}`,
        `  actual:   ${error.actualSequenceNumber}`,
      ].join("\n");
    case "CHAIN_ID_MISMATCH":
      return [
        `CHAIN_ID_MISMATCH at entry ${error.entryId}`,
        `  expected: ${error.expectedChainId}`,
        `  actual:   ${error.actualChainId}`,
      ].join("\n");
    case "ENTRY_NOT_FOUND":
      return `ENTRY_NOT_FOUND: ${error.entryId}`;
    case "EMPTY_CHAIN":
      return "EMPTY_CHAIN: chain contains no entries";
  }
}

/** Format an entry summary as a single line. */
export function formatEntrySummary(entry: ProofChainEntry): string {
  const parts = [
    `[${entry.sequenceNumber}]`,
    entry.entryId.slice(0, 12),
    entry.entryType,
    entry.timestamp,
  ];
  if (entry.modelId) {
    parts.push(entry.modelId);
  }
  return parts.join("  ");
}

/** Format full entry details for inspection. */
export function formatEntryDetail(entry: ProofChainEntry): string {
  const lines: Array<string> = [];
  lines.push("--- Entry ---");
  lines.push(`entryId:          ${entry.entryId}`);
  lines.push(`chainId:          ${entry.chainId}`);
  lines.push(`sequenceNumber:   ${entry.sequenceNumber}`);
  lines.push(`timestamp:        ${entry.timestamp}`);
  lines.push(`entryType:        ${entry.entryType}`);
  lines.push(`entryHash:        ${entry.entryHash}`);
  lines.push(`previousHash:     ${entry.previousHash ?? "(null)"}`);
  lines.push(`parentEntryId:    ${entry.parentEntryId ?? "(null)"}`);

  if (entry.modelId !== null || entry.modelProvider !== null) {
    lines.push("");
    lines.push("--- Tier 2: AI Context ---");
    lines.push(`modelId:          ${entry.modelId ?? "(null)"}`);
    lines.push(`modelProvider:    ${entry.modelProvider ?? "(null)"}`);
    lines.push(`inputHash:        ${entry.inputHash ?? "(null)"}`);
    lines.push(`outputHash:       ${entry.outputHash ?? "(null)"}`);
    lines.push(`inputTokenCount:  ${entry.inputTokenCount ?? "(null)"}`);
    lines.push(`outputTokenCount: ${entry.outputTokenCount ?? "(null)"}`);
    lines.push(`decisionType:     ${entry.decisionType ?? "(null)"}`);
    lines.push(`confidenceScore:  ${entry.confidenceScore ?? "(null)"}`);
    lines.push(`reasoningCertId:  ${entry.reasoningCertificateId ?? "(null)"}`);
    lines.push(`provenanceId:     ${entry.provenanceId ?? "(null)"}`);
  }

  if (
    entry.sessionId !== null ||
    entry.actorId !== null ||
    entry.policyIds.length > 0 ||
    Object.keys(entry.tags).length > 0 ||
    entry.annotation !== null
  ) {
    lines.push("");
    lines.push("--- Tier 3: Compliance ---");
    lines.push(`sessionId:        ${entry.sessionId ?? "(null)"}`);
    lines.push(`actorId:          ${entry.actorId ?? "(null)"}`);
    lines.push(`policyIds:        ${entry.policyIds.length > 0 ? entry.policyIds.join(", ") : "(none)"}`);
    lines.push(`tags:             ${Object.keys(entry.tags).length > 0 ? JSON.stringify(entry.tags) : "(none)"}`);
    lines.push(`annotation:       ${entry.annotation ?? "(null)"}`);
    if (Object.keys(entry.complianceMetadata).length > 0) {
      lines.push(`complianceMetadata: ${JSON.stringify(entry.complianceMetadata)}`);
    }
  }

  return lines.join("\n");
}

/** Format chain statistics. */
export function formatChainStats(
  chainId: string,
  entries: ReadonlyArray<ProofChainEntry>
): string {
  const lines: Array<string> = [];
  lines.push(`Chain: ${chainId}`);
  lines.push(`Total entries: ${entries.length}`);

  if (entries.length === 0) {
    return lines.join("\n");
  }

  const typeCounts = new Map<string, number>();
  let withModel = 0;
  let withParent = 0;
  let firstTimestamp = "";
  let lastTimestamp = "";

  for (const entry of entries) {
    typeCounts.set(entry.entryType, (typeCounts.get(entry.entryType) ?? 0) + 1);
    if (entry.modelId !== null) {
      withModel++;
    }
    if (entry.parentEntryId !== null) {
      withParent++;
    }
  }

  const first = entries[0];
  const last = entries[entries.length - 1];
  if (first) {
    firstTimestamp = first.timestamp;
  }
  if (last) {
    lastTimestamp = last.timestamp;
  }

  lines.push(`First entry: ${firstTimestamp}`);
  lines.push(`Last entry:  ${lastTimestamp}`);
  lines.push(`Entries with model: ${withModel}`);
  lines.push(`Entries with parent: ${withParent}`);
  lines.push("");
  lines.push("Entry types:");
  for (const [type, count] of [...typeCounts.entries()].sort()) {
    lines.push(`  ${type}: ${count}`);
  }

  return lines.join("\n");
}

/** Pad a string to a fixed width. */
export function padRight(str: string, width: number): string {
  if (str.length >= width) {
    return str;
  }
  return str + " ".repeat(width - str.length);
}

/** Format a table of chain IDs with entry counts. */
export function formatChainList(
  chains: ReadonlyArray<{ chainId: string; entryCount: number }>
): string {
  if (chains.length === 0) {
    return "No chains found.";
  }

  const header = `${padRight("Chain ID", 40)}  Entries`;
  const separator = "-".repeat(header.length);
  const rows = chains.map(
    (c) => `${padRight(c.chainId, 40)}  ${c.entryCount}`
  );

  return [header, separator, ...rows].join("\n");
}
