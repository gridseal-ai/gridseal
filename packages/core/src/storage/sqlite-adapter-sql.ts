import type { ProofChainEntry } from "../schema/proof-chain-entry.js";

export type EntryRow = {
  entry_id: string;
  chain_id: string;
  sequence_number: number;
  timestamp: string;
  entry_type: string;
  entry_hash: string;
  previous_hash: string | null;
  parent_entry_id: string | null;
  model_id: string | null;
  model_provider: string | null;
  input_hash: string | null;
  output_hash: string | null;
  input_token_count: number | null;
  output_token_count: number | null;
  decision_type: string | null;
  confidence_score: number | null;
  reasoning_certificate_id: string | null;
  provenance_id: string | null;
  session_id: string | null;
  actor_id: string | null;
  policy_ids: string;
  tags: string;
  annotation: string | null;
  compliance_metadata: string;
};

export type CertificateRow = {
  certificate_id: string;
  data: string;
};

export type ProvenanceRow = {
  provenance_id: string;
  data: string;
};

export function entryToRow(entry: ProofChainEntry): EntryRow {
  return {
    entry_id: entry.entryId,
    chain_id: entry.chainId,
    sequence_number: entry.sequenceNumber,
    timestamp: entry.timestamp,
    entry_type: entry.entryType,
    entry_hash: entry.entryHash,
    previous_hash: entry.previousHash,
    parent_entry_id: entry.parentEntryId,
    model_id: entry.modelId,
    model_provider: entry.modelProvider,
    input_hash: entry.inputHash,
    output_hash: entry.outputHash,
    input_token_count: entry.inputTokenCount,
    output_token_count: entry.outputTokenCount,
    decision_type: entry.decisionType,
    confidence_score: entry.confidenceScore,
    reasoning_certificate_id: entry.reasoningCertificateId,
    provenance_id: entry.provenanceId,
    session_id: entry.sessionId,
    actor_id: entry.actorId,
    policy_ids: JSON.stringify(entry.policyIds),
    tags: JSON.stringify(entry.tags),
    annotation: entry.annotation,
    compliance_metadata: JSON.stringify(entry.complianceMetadata),
  };
}

export function rowToEntry(row: EntryRow): ProofChainEntry {
  return {
    entryId: row.entry_id,
    chainId: row.chain_id,
    sequenceNumber: row.sequence_number,
    timestamp: row.timestamp,
    entryType: row.entry_type as ProofChainEntry["entryType"],
    entryHash: row.entry_hash,
    previousHash: row.previous_hash,
    parentEntryId: row.parent_entry_id,
    modelId: row.model_id,
    modelProvider: row.model_provider,
    inputHash: row.input_hash,
    outputHash: row.output_hash,
    inputTokenCount: row.input_token_count,
    outputTokenCount: row.output_token_count,
    decisionType: row.decision_type as ProofChainEntry["decisionType"],
    confidenceScore: row.confidence_score,
    reasoningCertificateId: row.reasoning_certificate_id,
    provenanceId: row.provenance_id,
    sessionId: row.session_id,
    actorId: row.actor_id,
    policyIds: JSON.parse(row.policy_ids) as ReadonlyArray<string>,
    tags: JSON.parse(row.tags) as Readonly<Record<string, string>>,
    annotation: row.annotation,
    complianceMetadata: JSON.parse(
      row.compliance_metadata
    ) as Readonly<Record<string, unknown>>,
  };
}

export const CREATE_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS entries (
    entry_id TEXT PRIMARY KEY,
    chain_id TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    entry_type TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    previous_hash TEXT,
    parent_entry_id TEXT,
    model_id TEXT,
    model_provider TEXT,
    input_hash TEXT,
    output_hash TEXT,
    input_token_count INTEGER,
    output_token_count INTEGER,
    decision_type TEXT,
    confidence_score REAL,
    reasoning_certificate_id TEXT,
    provenance_id TEXT,
    session_id TEXT,
    actor_id TEXT,
    policy_ids TEXT NOT NULL,
    tags TEXT NOT NULL,
    annotation TEXT,
    compliance_metadata TEXT NOT NULL
  )
`;

export const CREATE_ENTRIES_CHAIN_INDEX =
  "CREATE INDEX IF NOT EXISTS idx_entries_chain_id ON entries (chain_id, sequence_number)";

export const CREATE_ENTRIES_PARENT_INDEX =
  "CREATE INDEX IF NOT EXISTS idx_entries_parent_id ON entries (parent_entry_id)";

export const CREATE_CERTIFICATES_TABLE = `
  CREATE TABLE IF NOT EXISTS certificates (
    certificate_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )
`;

export const CREATE_PROVENANCE_TABLE = `
  CREATE TABLE IF NOT EXISTS provenance (
    provenance_id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  )
`;

export const INSERT_ENTRY = `
  INSERT INTO entries (
    entry_id, chain_id, sequence_number, timestamp, entry_type,
    entry_hash, previous_hash, parent_entry_id, model_id, model_provider,
    input_hash, output_hash, input_token_count, output_token_count,
    decision_type, confidence_score, reasoning_certificate_id, provenance_id,
    session_id, actor_id, policy_ids, tags, annotation, compliance_metadata
  ) VALUES (
    @entry_id, @chain_id, @sequence_number, @timestamp, @entry_type,
    @entry_hash, @previous_hash, @parent_entry_id, @model_id, @model_provider,
    @input_hash, @output_hash, @input_token_count, @output_token_count,
    @decision_type, @confidence_score, @reasoning_certificate_id, @provenance_id,
    @session_id, @actor_id, @policy_ids, @tags, @annotation, @compliance_metadata
  )
`;
